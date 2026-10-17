import { decodeArtifact, isLossless } from '@/lib/artifact-decoder';
import { generateConfigFromDb } from '@/lib/config-generator';
import { prisma } from '@/lib/db';

async function seedApp(identifier: string) {
	return prisma.app.create({
		data: {
			name: 'Gen Test App',
			identifier,
			artifactUrl: `https://cdn.example.com/${identifier}/`,
			publicKeys: [
				{
					kid: 'k1',
					pem: '-----BEGIN PUBLIC KEY-----\nX\n-----END PUBLIC KEY-----',
				},
			],
			fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
			storageConfig: {},
		},
	});
}

describe('generateConfigFromDb (integration)', () => {
	test('emits a schema-v1 artifact with environment-first flag defaults', async () => {
		const app = await seedApp(`gen-${Date.now()}`);

		await prisma.flag.create({
			data: {
				appId: app.id,
				key: 'new_paywall',
				displayName: 'New Paywall',
				type: 'BOOL',
				description: 'paywall toggle',
				defaultValues: { development: true, beta: false, production: false },
			},
		});

		const config = await generateConfigFromDb(app.id);

		expect(config.schema_version).toBe(1);
		expect(config.app_identifier).toBe(app.identifier);

		const flag = config.flags['new_paywall'];
		expect(flag).toBeDefined();
		// Prisma enum BOOL is normalised to the wire form 'bool'.
		expect(flag.type).toBe('bool');
		expect(flag.development.default).toBe(true);
		expect(flag.beta.default).toBe(false);
		expect(flag.production.default).toBe(false);
		expect(flag.development.variants).toEqual([]);
	});

	test('publishes legacy date-only values as UTC instants the SDKs decode', async () => {
		const app = await seedApp(`gen-${Date.now()}-dates`);

		// What dashboards before 1.0 stored: date-only strings.
		await prisma.flag.create({
			data: {
				appId: app.id,
				key: 'promo_end',
				displayName: 'Promo End',
				type: 'DATE',
				defaultValues: {
					development: '2026-06-25',
					beta: '2026-06-25T10:30:00Z',
					production: '2026-06-25',
				},
				variants: {
					production: [
						{
							id: 'v1',
							type: 'conditional',
							order: 1,
							value: '2026-12-31',
							conditions: [
								{ type: 'platform', operator: 'in', values: ['ios'] },
							],
						},
					],
				},
			},
		});

		const config = await generateConfigFromDb(app.id);
		const flag = config.flags['promo_end'];
		expect(flag.development.default).toBe('2026-06-25T00:00:00.000Z');
		expect(flag.beta.default).toBe('2026-06-25T10:30:00.000Z');
		expect(flag.production.variants?.[0].value).toBe(
			'2026-12-31T00:00:00.000Z',
		);

		const decoded = decodeArtifact(
			JSON.stringify({
				...config,
				config_version: 'v',
				published_at: '2026-01-01T00:00:00.000Z',
			}),
		);
		expect(isLossless(decoded)).toBe(true);
	});

	test('ships archived flags marked deprecated', async () => {
		const app = await seedApp(`gen-${Date.now()}-2`);

		await prisma.flag.create({
			data: {
				appId: app.id,
				key: 'live_flag',
				displayName: 'Live',
				type: 'STRING',
				defaultValues: { development: 'a', beta: 'b', production: 'c' },
			},
		});
		await prisma.flag.create({
			data: {
				appId: app.id,
				key: 'archived_flag',
				displayName: 'Archived',
				type: 'BOOL',
				archived: true,
				archivedAt: new Date(),
				defaultValues: {
					development: false,
					beta: false,
					production: false,
				},
			},
		});

		const config = await generateConfigFromDb(app.id);

		expect(config.flags.live_flag).toBeDefined();
		expect(config.flags.live_flag.deprecated).toBeUndefined();
		// Archived flags still ship so existing clients keep resolving them; they
		// carry `deprecated: true` so the SDK can signal the deprecation on read.
		// See docs/config-artifact-spec.md and the SDK's didReadDeprecatedFlag.
		expect(config.flags.archived_flag).toBeDefined();
		expect(config.flags.archived_flag.deprecated).toBe(true);
	});

	test('expands platform group tokens to concrete values, never shipping the token itself', async () => {
		const app = await seedApp(`gen-${Date.now()}-3`);

		const flag = await prisma.flag.create({
			data: {
				appId: app.id,
				key: 'gated_flag',
				displayName: 'Gated',
				type: 'BOOL',
				defaultValues: { development: false, beta: false, production: false },
				variants: {
					development: [
						{
							order: 0,
							value: true,
							conditions: [
								{
									type: 'platform',
									operator: 'in',
									values: ['all_apple', 'android'],
								},
							],
						},
					],
				},
			},
		});

		await prisma.testRollout.create({
			data: {
				appId: app.id,
				key: 'gated_test',
				name: 'Gated Test',
				type: 'TEST',
				salt: 'salt',
				conditions: [
					{ type: 'platform', operator: 'in', values: ['everything'] },
				],
				variants: {
					a: { percentage: 100, values: { development: { [flag.id]: false } } },
				},
				flagIds: [flag.id],
			},
		});

		const config = await generateConfigFromDb(app.id);

		const flagCondition =
			config.flags.gated_flag.development.variants?.[0].conditions?.[0];
		expect(flagCondition?.values).toEqual([
			'ios',
			'macos',
			'watchos',
			'tvos',
			'visionos',
			'android',
		]);

		const testCondition = config.tests.gated_test.conditions[0];
		expect(testCondition.values).toEqual([
			'ios',
			'android',
			'macos',
			'watchos',
			'tvos',
			'visionos',
			'web',
		]);

		const serialized = JSON.stringify(config);
		expect(serialized).not.toContain('all_apple');
		expect(serialized).not.toContain('everything');
	});
});
