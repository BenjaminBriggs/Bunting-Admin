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
				defaultValues: { development: true, staging: false, production: false },
			},
		});

		const config = await generateConfigFromDb(app.id);

		expect(config.schema_version).toBe(1);
		expect(config.app_identifier).toBe(app.identifier);

		const flag = (config.flags as Record<string, any>)['new_paywall'];
		expect(flag).toBeDefined();
		// Prisma enum BOOL is normalised to the wire form 'bool'.
		expect(flag.type).toBe('bool');
		expect(flag.development.default).toBe(true);
		expect(flag.staging.default).toBe(false);
		expect(flag.production.default).toBe(false);
		expect(flag.development.variants).toEqual([]);
	});

	test('includes cohorts and excludes archived flags', async () => {
		const app = await seedApp(`gen-${Date.now()}-2`);

		await prisma.cohort.create({
			data: {
				appId: app.id,
				key: 'beta_users',
				name: 'Beta Users',
				conditions: [
					{ id: 'c1', type: 'platform', operator: 'in', values: ['iOS'] },
				],
			},
		});

		await prisma.flag.create({
			data: {
				appId: app.id,
				key: 'live_flag',
				displayName: 'Live',
				type: 'STRING',
				defaultValues: { development: 'a', staging: 'b', production: 'c' },
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
					staging: false,
					production: false,
				},
			},
		});

		const config = await generateConfigFromDb(app.id);

		expect((config.cohorts as Record<string, any>).beta_users).toBeDefined();
		expect((config.flags as Record<string, any>).live_flag).toBeDefined();
		// Archived flags must not ship to the SDK.
		expect((config.flags as Record<string, any>).archived_flag).toBeUndefined();
	});
});
