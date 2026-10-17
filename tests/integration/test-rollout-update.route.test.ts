import { NextRequest } from 'next/server';
import { PUT as putRollout } from '@/app/api/rollouts/[id]/route';
import { POST as postComplete } from '@/app/api/test-rollouts/[id]/complete/route';
import { PUT as putTestRollout } from '@/app/api/test-rollouts/[id]/route';
import { PUT as putTest } from '@/app/api/tests/[id]/route';
import type { Prisma } from '@/generated/prisma/client';
import { generateConfigFromDb } from '@/lib/config-generator';
import { prisma } from '@/lib/db';
import {
	buildTestUpdatePayload,
	type StoredTestVariants,
} from '@/lib/test-group-variants';
import type { Condition } from '@/types';

// Update routes for tests and rollouts are partial: a field absent from the
// body keeps its stored value, and only an explicit null clears a nullable
// one. The edit pages rely on this to send only what they edit, so saving a
// rollout or test never detaches its flags or wipes its per-flag values.

let seq = 0;

async function seedApp() {
	seq += 1;
	return prisma.app.create({
		data: {
			name: 'Update App',
			identifier: `update-${seq}`,
			artifactUrl: `https://cdn.example.com/update-${seq}/`,
			publicKeys: [],
			fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
			storageConfig: {},
		},
	});
}

async function seedFlag(appId: string, key: string) {
	return prisma.flag.create({
		data: {
			appId,
			key,
			displayName: key,
			type: 'STRING',
			defaultValues: { development: 'off', beta: 'off', production: 'off' },
			variants: { development: [], beta: [], production: [] },
		},
	});
}

const iosOnly: Condition = {
	type: 'platform',
	operator: 'in',
	values: ['ios'],
};

async function seedRollout(appId: string, flagId: string) {
	return prisma.testRollout.create({
		data: {
			appId,
			key: 'paywall_rollout',
			name: 'Paywall rollout',
			description: 'Ship the new paywall',
			group: 'Growth',
			type: 'ROLLOUT',
			salt: 'salt_paywall_rollout',
			percentage: 25,
			conditions: [iosOnly] as unknown as Prisma.InputJsonValue,
			rolloutValues: {
				development: { [flagId]: 'new' },
				beta: { [flagId]: 'new' },
				production: { [flagId]: 'new' },
			},
			flagIds: [flagId],
		},
	});
}

// Two groups with per-flag values, like the Flags page writes them.
function storedGroups(flagId: string): StoredTestVariants {
	return {
		control: {
			percentage: 50,
			values: {
				development: { [flagId]: 'grey' },
				beta: { [flagId]: 'grey' },
				production: { [flagId]: 'grey' },
			},
		},
		treatment: {
			percentage: 50,
			values: {
				development: { [flagId]: 'green' },
				beta: { [flagId]: 'green' },
				production: { [flagId]: 'green' },
			},
		},
	};
}

async function seedTest(appId: string, flagId: string) {
	return prisma.testRollout.create({
		data: {
			appId,
			key: 'button_test',
			name: 'Button test',
			description: 'Green converts better',
			group: 'Growth',
			type: 'TEST',
			salt: 'salt_button_test',
			conditions: [],
			variants: storedGroups(flagId) as unknown as Prisma.InputJsonValue,
			flagIds: [flagId],
		},
	});
}

function put(url: string, body: unknown) {
	return new NextRequest(`http://local${url}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function updateTestRollout(id: string, body: unknown) {
	return putTestRollout(put(`/api/test-rollouts/${id}`, body), ctx(id));
}

async function stored(id: string) {
	return prisma.testRollout.findUniqueOrThrow({ where: { id } });
}

describe('PUT /api/test-rollouts/[id] is a partial update', () => {
	test('a rollout edit (what the edit page sends) keeps flagIds, rolloutValues and archived', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'paywall');
		const rollout = await seedRollout(app.id, flag.id);

		const res = await updateTestRollout(rollout.id, {
			name: 'Paywall rollout v2',
			description: 'Ship it wider',
			group: 'Growth',
			percentage: 50,
			conditions: [iosOnly],
		});
		expect(res.status).toBe(200);

		const after = await stored(rollout.id);
		expect(after.name).toBe('Paywall rollout v2');
		expect(after.percentage).toBe(50);
		expect(after.flagIds).toEqual([flag.id]);
		expect(after.rolloutValues).toEqual(rollout.rolloutValues);
		expect(after.archived).toBe(false);

		const config = await generateConfigFromDb(app.id);
		expect(config.flags.paywall.production.variants).toEqual([
			{ type: 'rollout', order: 10, rollout: 'paywall_rollout', value: 'new' },
		]);
		expect(config.rollouts.paywall_rollout.percentage).toBe(50);
	});

	test('a body with one field changes only that field', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'paywall');
		const rollout = await seedRollout(app.id, flag.id);

		const res = await updateTestRollout(rollout.id, { percentage: 75 });
		expect(res.status).toBe(200);

		const after = await stored(rollout.id);
		expect(after.percentage).toBe(75);
		expect(after.name).toBe('Paywall rollout');
		expect(after.description).toBe('Ship the new paywall');
		expect(after.group).toBe('Growth');
		expect(after.conditions).toEqual([iosOnly]);
		expect(after.flagIds).toEqual([flag.id]);
		expect(after.rolloutValues).toEqual(rollout.rolloutValues);
	});

	test('an explicit null clears description, group, variants and rolloutValues', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'paywall');
		const rollout = await seedRollout(app.id, flag.id);
		const test = await seedTest(app.id, flag.id);

		const r1 = await updateTestRollout(rollout.id, {
			description: null,
			group: null,
			rolloutValues: null,
		});
		expect(r1.status).toBe(200);
		const rolloutAfter = await stored(rollout.id);
		expect(rolloutAfter.description).toBeNull();
		expect(rolloutAfter.group).toBeNull();
		expect(rolloutAfter.rolloutValues).toBeNull();
		expect(rolloutAfter.flagIds).toEqual([flag.id]);

		const r2 = await updateTestRollout(test.id, { variants: null });
		expect(r2.status).toBe(200);
		const testAfter = await stored(test.id);
		expect(testAfter.variants).toBeNull();
		expect(testAfter.description).toBe('Green converts better');
	});

	test('an explicit empty flagIds detaches flags (only when sent)', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'paywall');
		const rollout = await seedRollout(app.id, flag.id);

		const res = await updateTestRollout(rollout.id, { flagIds: [] });
		expect(res.status).toBe(200);
		expect((await stored(rollout.id)).flagIds).toEqual([]);
	});

	test('rejects null for a field that cannot be cleared', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'paywall');
		const rollout = await seedRollout(app.id, flag.id);

		for (const body of [
			{ name: null },
			{ percentage: null },
			{ conditions: null },
			{ flagIds: null },
		]) {
			const res = await updateTestRollout(rollout.id, body);
			expect(res.status).toBe(400);
		}
		expect(await stored(rollout.id)).toEqual(rollout);
	});

	test('404 for an unknown id', async () => {
		const res = await updateTestRollout('missing', { name: 'x' });
		expect(res.status).toBe(404);
	});

	test('a finished record keeps its outcome: edits leave it archived, archived:false is refused', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'paywall');
		const rollout = await seedRollout(app.id, flag.id);
		const done = await postComplete(
			new NextRequest(`http://local/api/test-rollouts/${rollout.id}/complete`, {
				method: 'POST',
			}),
			ctx(rollout.id),
		);
		expect(done.status).toBe(200);

		const edit = await updateTestRollout(rollout.id, { name: 'Renamed' });
		expect(edit.status).toBe(200);
		const afterEdit = await stored(rollout.id);
		expect(afterEdit.name).toBe('Renamed');
		expect(afterEdit.archived).toBe(true);
		expect(afterEdit.outcome).toBe('COMPLETED');

		const reactivate = await updateTestRollout(rollout.id, { archived: false });
		expect(reactivate.status).toBe(409);
		expect((await stored(rollout.id)).archived).toBe(true);
	});
});

describe('test edit keeps per-flag group values', () => {
	async function editTest(
		groups: Array<{ name: string; weight: number; storedName?: string }>,
	) {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'button_color');
		const test = await seedTest(app.id, flag.id);
		const before = test.variants as unknown as StoredTestVariants;

		// The body the edit page sends for this form submission.
		const body = buildTestUpdatePayload(before, {
			name: test.name,
			description: test.description ?? '',
			group: test.group ?? '',
			conditions: [],
			groups,
		});
		const res = await updateTestRollout(test.id, body);
		expect(res.status).toBe(200);

		const after = await stored(test.id);
		return {
			app,
			flag,
			before,
			after,
			variants: after.variants as unknown as StoredTestVariants,
		};
	}

	test('changing percentages keeps every group value and the attached flags', async () => {
		const { app, flag, before, after, variants } = await editTest([
			{ name: 'control', weight: 30, storedName: 'control' },
			{ name: 'treatment', weight: 70, storedName: 'treatment' },
		]);

		expect(variants).toEqual({
			control: { ...before.control, percentage: 30 },
			treatment: { ...before.treatment, percentage: 70 },
		});
		expect(after.flagIds).toEqual([flag.id]);
		expect(after.archived).toBe(false);

		const config = await generateConfigFromDb(app.id);
		expect(config.flags.button_color.production.variants).toEqual([
			{
				type: 'test',
				order: 10,
				test: 'button_test',
				values: { control: 'grey', treatment: 'green' },
			},
		]);
		expect(config.tests.button_test.groups).toEqual([
			{ name: 'control', percentage: 30 },
			{ name: 'treatment', percentage: 70 },
		]);
	});

	test('an added group has no values, so it serves nothing (no empty-string placeholder)', async () => {
		const { app, before, variants } = await editTest([
			{ name: 'control', weight: 34, storedName: 'control' },
			{ name: 'treatment', weight: 33, storedName: 'treatment' },
			{ name: 'blue', weight: 33 },
		]);

		expect(variants.blue).toEqual({ percentage: 33 });
		expect(variants.control.values).toEqual(before.control.values);
		expect(variants.treatment.values).toEqual(before.treatment.values);

		const config = await generateConfigFromDb(app.id);
		const prod = config.flags.button_color.production.variants ?? [];
		expect(prod).toHaveLength(1);
		expect(prod[0].values).toEqual({ control: 'grey', treatment: 'green' });
		// jsonb does not keep key order, so compare the group set.
		expect(config.tests.button_test.groups?.map((g) => g.name).sort()).toEqual([
			'blue',
			'control',
			'treatment',
		]);
	});

	test('a removed group is dropped with its values', async () => {
		// The form keeps at least two groups, so control is replaced by a new one.
		const { app, before, variants } = await editTest([
			{ name: 'treatment', weight: 50, storedName: 'treatment' },
			{ name: 'blue', weight: 50 },
		]);

		expect(variants).toEqual({
			treatment: { ...before.treatment, percentage: 50 },
			blue: { percentage: 50 },
		});
		const config = await generateConfigFromDb(app.id);
		expect(config.flags.button_color.beta.variants?.[0].values).toEqual({
			treatment: 'green',
		});
	});

	test('a renamed group keeps its values under the new name', async () => {
		const { app, before, variants } = await editTest([
			{ name: 'baseline', weight: 50, storedName: 'control' },
			{ name: 'treatment', weight: 50, storedName: 'treatment' },
		]);

		expect(Object.keys(variants)).toEqual(['baseline', 'treatment']);
		expect(variants.baseline.values).toEqual(before.control.values);
		const config = await generateConfigFromDb(app.id);
		expect(config.flags.button_color.development.variants?.[0].values).toEqual({
			baseline: 'grey',
			treatment: 'green',
		});
	});

	test('a save that changes no group sends no variants and leaves them untouched', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'button_color');
		const test = await seedTest(app.id, flag.id);
		const loaded = test.variants as unknown as StoredTestVariants;

		// Values set from the Flags page after the edit page loaded.
		const newer = storedGroups(flag.id);
		newer.treatment.values = {
			development: { [flag.id]: 'blue' },
			beta: { [flag.id]: 'blue' },
			production: { [flag.id]: 'blue' },
		};
		await prisma.testRollout.update({
			where: { id: test.id },
			data: { variants: newer as unknown as Prisma.InputJsonValue },
		});

		const body = buildTestUpdatePayload(loaded, {
			name: 'Button test, renamed',
			description: '',
			group: '',
			conditions: [],
			groups: [
				{ name: 'control', weight: 50, storedName: 'control' },
				{ name: 'treatment', weight: 50, storedName: 'treatment' },
			],
		});
		expect(body).not.toHaveProperty('variants');
		const res = await updateTestRollout(test.id, body);
		expect(res.status).toBe(200);

		const after = await stored(test.id);
		expect(after.name).toBe('Button test, renamed');
		expect(after.variants).toEqual(newer);
	});
});

describe('secondary routes are partial updates too', () => {
	test('PUT /api/tests/[id] with only a name keeps variants, flagIds and conditions', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'button_color');
		const test = await seedTest(app.id, flag.id);

		const res = await putTest(
			put(`/api/tests/${test.id}`, { name: 'Renamed test' }),
			ctx(test.id),
		);
		expect(res.status).toBe(200);

		const after = await stored(test.id);
		expect(after.name).toBe('Renamed test');
		expect(after.variants).toEqual(test.variants);
		expect(after.flagIds).toEqual([flag.id]);
		expect(after.conditions).toEqual([]);
		expect(after.description).toBe('Green converts better');
		expect(after.archived).toBe(false);
	});

	test('PUT /api/tests/[id] clears description only on explicit null', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'button_color');
		const test = await seedTest(app.id, flag.id);

		const res = await putTest(
			put(`/api/tests/${test.id}`, { description: null }),
			ctx(test.id),
		);
		expect(res.status).toBe(200);
		const after = await stored(test.id);
		expect(after.description).toBeNull();
		expect(after.variants).toEqual(test.variants);
	});

	test('PUT /api/rollouts/[id] with only a percentage keeps rolloutValues and flagIds', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'paywall');
		const rollout = await seedRollout(app.id, flag.id);

		const res = await putRollout(
			put(`/api/rollouts/${rollout.id}`, { percentage: 80 }),
			ctx(rollout.id),
		);
		expect(res.status).toBe(200);

		const after = await stored(rollout.id);
		expect(after.percentage).toBe(80);
		expect(after.rolloutValues).toEqual(rollout.rolloutValues);
		expect(after.flagIds).toEqual([flag.id]);
		expect(after.conditions).toEqual([iosOnly]);
		expect(after.description).toBe('Ship the new paywall');
	});

	test('PUT /api/rollouts/[id] clears description only on explicit null', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'paywall');
		const rollout = await seedRollout(app.id, flag.id);

		const res = await putRollout(
			put(`/api/rollouts/${rollout.id}`, { description: null }),
			ctx(rollout.id),
		);
		expect(res.status).toBe(200);
		const after = await stored(rollout.id);
		expect(after.description).toBeNull();
		expect(after.rolloutValues).toEqual(rollout.rolloutValues);
	});

	test('the type filter still answers 404 for the other type and unknown ids', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'paywall');
		const rollout = await seedRollout(app.id, flag.id);
		const test = await seedTest(app.id, flag.id);

		expect(
			(
				await putTest(
					put(`/api/tests/${rollout.id}`, { name: 'x' }),
					ctx(rollout.id),
				)
			).status,
		).toBe(404);
		expect(
			(
				await putRollout(
					put(`/api/rollouts/${test.id}`, { name: 'x' }),
					ctx(test.id),
				)
			).status,
		).toBe(404);
		expect(
			(await putTest(put('/api/tests/missing', { name: 'x' }), ctx('missing')))
				.status,
		).toBe(404);
		expect(
			(
				await putRollout(
					put('/api/rollouts/missing', { name: 'x' }),
					ctx('missing'),
				)
			).status,
		).toBe(404);
	});
});
