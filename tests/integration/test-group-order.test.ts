import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { PUT as putTestRollout } from '@/app/api/test-rollouts/[id]/route';
import { PUT as putTest } from '@/app/api/tests/[id]/route';
import { POST as postTest } from '@/app/api/tests/route';
import { assignVariant } from '@/lib/bucketing';
import { generateConfigFromDb } from '@/lib/config-generator';
import { prisma } from '@/lib/db';
import {
	buildTestUpdatePayload,
	orderedTestGroups,
	type StoredTestVariants,
} from '@/lib/test-group-variants';
import type { ConfigArtifact } from '@/types';
import { seedLegacyApp } from '../helpers/legacy-test-groups';

// SDKs bucket a user into a test group by cumulative percentage in the order
// of the artifact's `groups`, so that order must never change on an edit.
// Postgres jsonb sorts object keys shorter-first, so it comes from each
// group's stored `position`, not from key order. Legacy rows without
// positions keep the order they were already published with.

async function seedApp() {
	return prisma.app.create({
		data: {
			name: 'Group Order App',
			identifier: 'group-order',
			artifactUrl: 'https://cdn.example.com/group-order/',
			publicKeys: [],
			fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
			storageConfig: {},
		},
	});
}

function request(method: string, url: string, body: unknown) {
	return new NextRequest(`http://local${url}`, {
		method,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

// Create a test the way the create page does, then give each group a value
// for a flag the way the Flags page does (spreading the stored groups).
async function createTest(groups: Array<[string, number]>) {
	const app = await seedApp();
	const flag = await prisma.flag.create({
		data: {
			appId: app.id,
			key: 'checkout/button_color',
			displayName: 'Button color',
			type: 'STRING',
			defaultValues: { development: 'grey', beta: 'grey', production: 'grey' },
			variants: { development: [], beta: [], production: [] },
		},
	});
	const created = await postTest(
		request('POST', '/api/tests', {
			key: 'checkout_test',
			name: 'Checkout test',
			conditions: [],
			variantCount: groups.length,
			trafficSplit: groups.map(([, pct]) => pct),
			variantNames: groups.map(([name]) => name),
			appId: app.id,
		}),
	);
	expect(created.status).toBe(201);
	const { id, variants } = (await created.json()) as {
		id: string;
		variants: StoredTestVariants;
	};

	const withValues = Object.fromEntries(
		Object.entries(variants).map(([name, group]) => [
			name,
			{ ...group, values: { production: { [flag.id]: `value_${name}` } } },
		]),
	);
	const assigned = await putTest(
		request('PUT', `/api/tests/${id}`, {
			variants: withValues,
			flagIds: [flag.id],
		}),
		ctx(id),
	);
	expect(assigned.status).toBe(200);
	return { app, id };
}

// What the edit page loads: the record as the API serializes it.
async function load(id: string) {
	const row = await prisma.testRollout.findUniqueOrThrow({ where: { id } });
	const json = JSON.parse(JSON.stringify(row)) as typeof row;
	return {
		...json,
		variants: json.variants as unknown as StoredTestVariants,
	};
}

// Submit the edit form: rows in the order the edit page shows them
// (orderedTestGroups), with `edit` applied.
async function editGroups(
	id: string,
	edit: (
		rows: Array<{ name: string; weight: number; storedName?: string }>,
	) => Array<{ name: string; weight: number; storedName?: string }>,
) {
	const loaded = await load(id);
	const rows = orderedTestGroups(loaded.variants).map(([name, g]) => ({
		name,
		weight: g.percentage,
		storedName: name,
	}));
	const res = await putTestRollout(
		request(
			'PUT',
			`/api/test-rollouts/${id}`,
			buildTestUpdatePayload(loaded.variants, {
				name: loaded.name,
				description: loaded.description ?? '',
				group: loaded.group ?? '',
				conditions: [],
				groups: edit(rows),
			}),
		),
		ctx(id),
	);
	expect(res.status).toBe(200);
}

const groupsOf = (config: ConfigArtifact, test: string) =>
	(config.tests[test].groups ?? []).map((g) => [g.name, g.percentage]);

const prodValues = (config: ConfigArtifact) =>
	config.flags['checkout/button_color'].production.variants?.find(
		(v) => v.type === 'test',
	)?.values;

describe('test group order', () => {
	test('a created test buckets its groups in the authored order, not key order', async () => {
		const { app, id } = await createTest([
			['treatment_long_name', 30],
			['control', 50],
			['b', 20],
		]);

		const stored = (await load(id)).variants;
		expect(stored.treatment_long_name.position).toBe(0);
		expect(stored.control.position).toBe(1);
		expect(stored.b.position).toBe(2);

		const config = await generateConfigFromDb(app.id);
		expect(groupsOf(config, 'checkout_test')).toEqual([
			['treatment_long_name', 30],
			['control', 50],
			['b', 20],
		]);
		expect(Object.keys(prodValues(config) ?? {})).toEqual([
			'treatment_long_name',
			'control',
			'b',
		]);
	});

	test('renaming a group to a different-length name keeps the emitted order, so no user changes group', async () => {
		const { app, id } = await createTest([
			['treatment', 30],
			['control', 70],
		]);
		const before = await generateConfigFromDb(app.id);

		// "c" sorts ahead of "treatment" in jsonb.
		await editGroups(id, (rows) =>
			rows.map((r) => (r.name === 'control' ? { ...r, name: 'c' } : r)),
		);

		const after = await generateConfigFromDb(app.id);
		expect(groupsOf(after, 'checkout_test')).toEqual([
			['treatment', 30],
			['c', 70],
		]);
		expect(prodValues(after)).toEqual({
			treatment: 'value_treatment',
			c: 'value_control',
		});
		expect(Object.keys(prodValues(after) ?? {})).toEqual(['treatment', 'c']);

		// Every user lands in the same group as before, under its new name.
		const salt = after.tests.checkout_test.salt;
		const renamed = { treatment: 'treatment', control: 'c' } as const;
		const seen = new Set<string>();
		for (let i = 0; i < 200; i++) {
			const user = `user-${i}`;
			const was = assignVariant(
				salt,
				user,
				before.tests.checkout_test.groups ?? [],
			);
			const now = assignVariant(
				salt,
				user,
				after.tests.checkout_test.groups ?? [],
			);
			expect(now).toBe(renamed[was as keyof typeof renamed]);
			seen.add(String(was));
		}
		expect(seen).toEqual(new Set(['treatment', 'control']));
	});

	test('an added group is appended after the existing groups', async () => {
		const { app, id } = await createTest([
			['treatment', 50],
			['control', 50],
		]);

		// "b" sorts first in jsonb.
		await editGroups(id, (rows) => [
			{ ...rows[0], weight: 40 },
			{ ...rows[1], weight: 40 },
			{ name: 'b', weight: 20 },
		]);

		const config = await generateConfigFromDb(app.id);
		expect(groupsOf(config, 'checkout_test')).toEqual([
			['treatment', 40],
			['control', 40],
			['b', 20],
		]);
		expect((await load(id)).variants.b).toEqual({
			percentage: 20,
			position: 2,
		});
	});

	test('a removed group leaves the others in their order', async () => {
		const { app, id } = await createTest([
			['treatment_long_name', 30],
			['b', 30],
			['control', 40],
		]);

		await editGroups(id, (rows) => [
			{ ...rows[0], weight: 50 },
			{ ...rows[2], weight: 50 },
		]);

		const config = await generateConfigFromDb(app.id);
		expect(groupsOf(config, 'checkout_test')).toEqual([
			['treatment_long_name', 50],
			['control', 50],
		]);
	});

	test('generated artifacts for legacy rows without positions are byte-identical to before positions existed', async () => {
		const app = await seedLegacyApp();

		// Generated by the config generator before group positions existed.
		const before: unknown = JSON.parse(
			readFileSync(
				path.join(__dirname, '../helpers/legacy-test-groups.artifact.json'),
				'utf8',
			),
		);
		const config = await generateConfigFromDb(app.id);
		expect(JSON.stringify(config)).toBe(JSON.stringify(before));
		// jsonb key order, not insertion order.
		expect(groupsOf(config, 'checkout_test').map(([name]) => name)).toEqual([
			'b',
			'control',
			'treatment_long_name',
		]);
	});

	test('editing a legacy row keeps its emitted order and records it as positions', async () => {
		const app = await seedLegacyApp();
		const legacy = await prisma.testRollout.findFirstOrThrow({
			where: { appId: app.id, key: 'checkout_test' },
		});
		const before = await generateConfigFromDb(app.id);
		expect(groupsOf(before, 'checkout_test')).toEqual([
			['b', 30],
			['control', 40],
			['treatment_long_name', 30],
		]);

		// jsonb would sort "blue_group_long" after "control".
		await editGroups(legacy.id, (rows) =>
			rows.map((r) => (r.name === 'b' ? { ...r, name: 'blue_group_long' } : r)),
		);

		const after = await generateConfigFromDb(app.id);
		expect(groupsOf(after, 'checkout_test')).toEqual([
			['blue_group_long', 30],
			['control', 40],
			['treatment_long_name', 30],
		]);
		const stored = (await load(legacy.id)).variants;
		expect(
			Object.fromEntries(
				Object.entries(stored).map(([name, g]) => [name, g.position]),
			),
		).toEqual({ blue_group_long: 0, control: 1, treatment_long_name: 2 });
		// The other legacy test, not edited, is unchanged.
		expect(after.tests.limit_test).toEqual(before.tests.limit_test);
	});

	test('rejects duplicate group names on create', async () => {
		const app = await seedApp();
		const res = await postTest(
			request('POST', '/api/tests', {
				key: 'dup_test',
				name: 'Dup test',
				conditions: [],
				variantCount: 2,
				trafficSplit: [50, 50],
				variantNames: ['control', 'control'],
				appId: app.id,
			}),
		);
		expect(res.status).toBe(400);
	});
});

describe('group positions are server-owned on update routes', () => {
	// A `variants` body as a client might send it: every group without its
	// position, in jsonb (shortest-name-first) key order.
	const stripPositions = (variants: StoredTestVariants) =>
		Object.fromEntries(
			Object.entries(variants)
				.sort(([a], [b]) => a.length - b.length)
				.map(([name, { position: _position, ...group }]) => [name, group]),
		);

	const positionsOf = async (id: string) =>
		Object.fromEntries(
			Object.entries((await load(id)).variants).map(([name, g]) => [
				name,
				g.position,
			]),
		);

	test.each([
		['PUT /api/tests/[id]', 'tests'],
		['PUT /api/test-rollouts/[id]', 'test-rollouts'],
	])(
		'%s without positions on a positioned row keeps the order',
		async (_, route) => {
			const { app, id } = await createTest([
				['treatment_long_name', 30],
				['control', 70],
			]);
			const body = {
				variants: stripPositions((await load(id)).variants),
			};

			const put = route === 'tests' ? putTest : putTestRollout;
			const res = await put(
				request('PUT', `/api/${route}/${id}`, body),
				ctx(id),
			);
			expect(res.status).toBe(200);

			expect(await positionsOf(id)).toEqual({
				treatment_long_name: 0,
				control: 1,
			});
			const config = await generateConfigFromDb(app.id);
			expect(groupsOf(config, 'checkout_test')).toEqual([
				['treatment_long_name', 30],
				['control', 70],
			]);
		},
	);

	test('a PUT without positions on a legacy row keeps its current order and records it', async () => {
		const app = await seedLegacyApp();
		const legacy = await prisma.testRollout.findFirstOrThrow({
			where: { appId: app.id, key: 'checkout_test' },
		});
		const before = await generateConfigFromDb(app.id);

		// Same groups in insertion order, which is not the emitted order.
		const stored = (await load(legacy.id)).variants;
		const res = await putTest(
			request('PUT', `/api/tests/${legacy.id}`, {
				variants: {
					treatment_long_name: stored.treatment_long_name,
					control: stored.control,
					b: stored.b,
				},
			}),
			ctx(legacy.id),
		);
		expect(res.status).toBe(200);

		expect(await positionsOf(legacy.id)).toEqual({
			b: 0,
			control: 1,
			treatment_long_name: 2,
		});
		const after = await generateConfigFromDb(app.id);
		expect(after.tests.checkout_test.groups).toEqual(
			before.tests.checkout_test.groups,
		);
		expect(JSON.stringify(after)).toBe(JSON.stringify(before));
	});

	test('a new group sent without a position is appended after the highest position', async () => {
		const { app, id } = await createTest([
			['treatment', 50],
			['control', 50],
		]);
		const stored = (await load(id)).variants;

		// "a" sorts first in jsonb and is sent first.
		const res = await putTest(
			request('PUT', `/api/tests/${id}`, {
				variants: {
					a: { percentage: 20 },
					...stripPositions({
						treatment: { ...stored.treatment, percentage: 40 },
						control: { ...stored.control, percentage: 40 },
					}),
				},
			}),
			ctx(id),
		);
		expect(res.status).toBe(200);

		expect(await positionsOf(id)).toEqual({ treatment: 0, control: 1, a: 2 });
		const config = await generateConfigFromDb(app.id);
		expect(groupsOf(config, 'checkout_test')).toEqual([
			['treatment', 40],
			['control', 40],
			['a', 20],
		]);
	});

	test('positions a client sends are used as given', async () => {
		const { app, id } = await createTest([
			['treatment', 30],
			['control', 70],
		]);
		const stored = (await load(id)).variants;

		const res = await putTestRollout(
			request('PUT', `/api/test-rollouts/${id}`, {
				variants: {
					treatment: { ...stored.treatment, position: 5 },
					control: { ...stored.control, position: 1 },
				},
			}),
			ctx(id),
		);
		expect(res.status).toBe(200);

		const config = await generateConfigFromDb(app.id);
		expect(groupsOf(config, 'checkout_test')).toEqual([
			['control', 70],
			['treatment', 30],
		]);
	});
});
