import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';

// An app whose tests were stored before groups had a `position`: each group
// is just { percentage, values }. Group names have different lengths and are
// inserted out of jsonb key order (jsonb sorts keys shorter-first), so the
// order Prisma returns differs from the insertion order.
export async function seedLegacyApp() {
	const app = await prisma.app.create({
		data: {
			name: 'Legacy Groups App',
			identifier: 'legacy-groups',
			artifactUrl: 'https://cdn.example.com/legacy-groups/',
			publicKeys: [],
			fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
			storageConfig: {},
		},
	});
	const color = await prisma.flag.create({
		data: {
			appId: app.id,
			key: 'checkout/button_color',
			displayName: 'Button color',
			type: 'STRING',
			defaultValues: { development: 'grey', beta: 'grey', production: 'grey' },
			variants: {
				development: [],
				beta: [],
				production: [
					{
						id: 'v1',
						name: 'iOS',
						type: 'conditional',
						order: 1,
						value: 'black',
						conditions: [{ type: 'platform', operator: 'in', values: ['ios'] }],
					},
				],
			},
		},
	});
	const limit = await prisma.flag.create({
		data: {
			appId: app.id,
			key: 'checkout/item_limit',
			displayName: 'Item limit',
			type: 'INT',
			defaultValues: { development: 5, beta: 5, production: 5 },
			variants: { development: [], beta: [], production: [] },
		},
	});

	const both = (c: string, l: number) => ({
		development: { [color.id]: c, [limit.id]: l },
		beta: { [color.id]: c, [limit.id]: l },
		production: { [color.id]: c, [limit.id]: l },
	});
	await prisma.testRollout.create({
		data: {
			appId: app.id,
			key: 'checkout_test',
			name: 'Checkout test',
			type: 'TEST',
			salt: 'salt_checkout_test',
			conditions: [],
			variants: {
				treatment_long_name: { percentage: 30, values: both('green', 8) },
				control: { percentage: 40, values: both('grey', 5) },
				b: { percentage: 30, values: both('blue', 10) },
			},
			flagIds: [color.id, limit.id],
		},
	});
	await prisma.testRollout.create({
		data: {
			appId: app.id,
			key: 'limit_test',
			name: 'Limit test',
			type: 'TEST',
			salt: 'salt_limit_test',
			conditions: [
				{
					type: 'app_version',
					operator: 'greater_than_or_equal',
					values: ['2.0.0'],
				},
			] as Prisma.InputJsonValue,
			variants: {
				zeta: { percentage: 50, values: { production: { [limit.id]: 20 } } },
				alpha_group: {
					percentage: 50,
					values: { production: { [limit.id]: 1 } },
				},
			},
			flagIds: [limit.id],
		},
	});
	await prisma.testRollout.create({
		data: {
			appId: app.id,
			key: 'color_rollout',
			name: 'Color rollout',
			type: 'ROLLOUT',
			salt: 'salt_color_rollout',
			percentage: 10,
			conditions: [],
			rolloutValues: { production: { [color.id]: 'red' } },
			flagIds: [color.id],
		},
	});
	return app;
}
