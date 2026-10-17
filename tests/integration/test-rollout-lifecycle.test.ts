import { NextRequest } from 'next/server';
import { POST as postArchive } from '@/app/api/test-rollouts/[id]/archive/route';
import { POST as postComplete } from '@/app/api/test-rollouts/[id]/complete/route';
import { PUT as putTestRollout } from '@/app/api/test-rollouts/[id]/route';
import type { Prisma } from '@/generated/prisma/client';
import { generateConfigFromDb } from '@/lib/config-generator';
import { prisma } from '@/lib/db';
import type { Condition, FlagValue } from '@/types';

// Completing a test/rollout bakes its outcome into the attached flags (default
// or conditional variant) before archiving; abandoning archives without baking.
// Every assertion about what users get is made on the generated artifact.

let seq = 0;

async function seedApp() {
	seq += 1;
	return prisma.app.create({
		data: {
			name: 'Lifecycle App',
			identifier: `lifecycle-${seq}`,
			artifactUrl: `https://cdn.example.com/lifecycle-${seq}/`,
			publicKeys: [],
			fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
			storageConfig: {},
		},
	});
}

type Env = 'development' | 'beta' | 'production';

async function seedFlag(
	appId: string,
	key: string,
	type: 'BOOL' | 'STRING',
	defaultValues: Record<Env, FlagValue>,
	variants: Partial<Record<Env, unknown[]>> = {},
) {
	return prisma.flag.create({
		data: {
			appId,
			key,
			displayName: key,
			type,
			defaultValues,
			variants: {
				development: [],
				beta: [],
				production: [],
				...variants,
			} as Prisma.InputJsonValue,
		},
	});
}

async function seedRollout(
	appId: string,
	key: string,
	opts: {
		flagIds: string[];
		rolloutValues: Partial<Record<Env, Record<string, FlagValue>>>;
		conditions?: Condition[];
		percentage?: number;
	},
) {
	return prisma.testRollout.create({
		data: {
			appId,
			key,
			name: key,
			type: 'ROLLOUT',
			salt: `salt_${key}`,
			percentage: opts.percentage ?? 25,
			conditions: (opts.conditions ?? []) as unknown as Prisma.InputJsonValue,
			rolloutValues: opts.rolloutValues,
			flagIds: opts.flagIds,
		},
	});
}

async function seedTest(
	appId: string,
	key: string,
	opts: {
		flagIds: string[];
		// group → env → flagId → value
		groups: Record<string, Partial<Record<Env, Record<string, FlagValue>>>>;
		conditions?: Condition[];
	},
) {
	const names = Object.keys(opts.groups);
	const variants = Object.fromEntries(
		names.map((name) => [
			name,
			{
				percentage: 100 / names.length,
				values: opts.groups[name],
			},
		]),
	);
	return prisma.testRollout.create({
		data: {
			appId,
			key,
			name: key,
			type: 'TEST',
			salt: `salt_${key}`,
			conditions: (opts.conditions ?? []) as unknown as Prisma.InputJsonValue,
			variants,
			flagIds: opts.flagIds,
		},
	});
}

function post(url: string, body?: unknown) {
	return new NextRequest(`http://local${url}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function complete(id: string, body?: unknown) {
	return postComplete(post(`/api/test-rollouts/${id}/complete`, body), ctx(id));
}

function abandon(id: string, body?: unknown) {
	return postArchive(post(`/api/test-rollouts/${id}/archive`, body), ctx(id));
}

const iosOnly: Condition = {
	type: 'platform',
	operator: 'in',
	values: ['ios'],
};
const appV2: Condition = {
	type: 'app_version',
	operator: 'greater_than_or_equal',
	values: ['2.0.0'],
};

describe('POST /api/test-rollouts/[id]/complete (rollouts)', () => {
	test('without entry conditions: the rollout value becomes the default and the rollout leaves the artifact', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'new_checkout', 'BOOL', {
			development: false,
			beta: false,
			production: false,
		});
		const rollout = await seedRollout(app.id, 'checkout_rollout', {
			flagIds: [flag.id],
			rolloutValues: {
				beta: { [flag.id]: true },
				production: { [flag.id]: true },
			},
		});

		const before = await generateConfigFromDb(app.id);
		expect(before.flags.new_checkout.production.variants).toEqual([
			expect.objectContaining({ type: 'rollout', rollout: 'checkout_rollout' }),
		]);

		const res = await complete(rollout.id);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			archived: boolean;
			outcome: string;
			percentage: number;
			completedAt: string | null;
		};
		expect(body.archived).toBe(true);
		expect(body.outcome).toBe('COMPLETED');
		expect(body.percentage).toBe(100);
		expect(body.completedAt).not.toBeNull();

		const after = await generateConfigFromDb(app.id);
		const out = after.flags.new_checkout;
		expect(out.production.default).toBe(true);
		expect(out.beta.default).toBe(true);
		// No rollout value in development, so its default is untouched.
		expect(out.development.default).toBe(false);
		for (const env of ['development', 'beta', 'production'] as const) {
			expect(out[env].variants).toEqual([]);
		}
		expect(after.rollouts).toEqual({});

		const activity = await prisma.activityLog.findFirst({
			where: { entityId: rollout.id, action: 'complete' },
		});
		expect(activity?.summary).toMatch(/Completed rollout checkout_rollout/);
		const changes = activity?.changes as { baked?: unknown[] } | null;
		expect(changes?.baked).toContainEqual({
			flagId: flag.id,
			flagKey: 'new_checkout',
			environment: 'production',
			kind: 'default',
			value: true,
			previousDefault: false,
		});
	});

	test('with entry conditions: a conditional variant takes the rollout position, ahead of later rollouts', async () => {
		const app = await seedApp();
		const flag = await seedFlag(
			app.id,
			'banner_copy',
			'STRING',
			{ development: 'base', beta: 'base', production: 'base' },
			{
				production: [
					{
						id: 'existing',
						name: 'iOS',
						type: 'conditional',
						order: 1,
						value: 'ios copy',
						conditions: [iosOnly],
					},
				],
			},
		);
		const rollout = await seedRollout(app.id, 'a_banner_rollout', {
			flagIds: [flag.id],
			conditions: [appV2],
			rolloutValues: { production: { [flag.id]: 'v2 copy' } },
		});
		// Evaluated after a_banner_rollout (keys order test/rollout variants).
		await seedRollout(app.id, 'z_banner_rollout', {
			flagIds: [flag.id],
			rolloutValues: { production: { [flag.id]: 'z copy' } },
		});

		const before = await generateConfigFromDb(app.id);
		expect(
			before.flags.banner_copy.production.variants?.map(
				(v) => v.rollout ?? v.value,
			),
		).toEqual(['ios copy', 'a_banner_rollout', 'z_banner_rollout']);

		const res = await complete(rollout.id);
		expect(res.status).toBe(200);

		const after = await generateConfigFromDb(app.id);
		const prod = after.flags.banner_copy.production;
		expect(prod.default).toBe('base');
		expect(prod.variants).toEqual([
			expect.objectContaining({ type: 'conditional', value: 'ios copy' }),
			{
				type: 'conditional',
				order: 2,
				value: 'v2 copy',
				conditions: [appV2],
			},
			expect.objectContaining({ type: 'rollout', rollout: 'z_banner_rollout' }),
		]);
		expect(Object.keys(after.rollouts)).toEqual(['z_banner_rollout']);
		// Environments without a rollout value are untouched.
		expect(after.flags.banner_copy.beta.variants).toEqual([]);
	});

	test('refuses (409) when a later test/rollout would start receiving users once the value is the default', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'search_v2', 'BOOL', {
			development: false,
			beta: false,
			production: false,
		});
		const rollout = await seedRollout(app.id, 'a_search_rollout', {
			flagIds: [flag.id],
			rolloutValues: { production: { [flag.id]: true } },
		});
		await seedRollout(app.id, 'b_search_rollout', {
			flagIds: [flag.id],
			rolloutValues: { production: { [flag.id]: false } },
		});

		const res = await complete(rollout.id);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/"b_search_rollout"/);

		const stored = await prisma.flag.findUniqueOrThrow({
			where: { id: flag.id },
		});
		expect(stored.defaultValues).toEqual({
			development: false,
			beta: false,
			production: false,
		});
		const record = await prisma.testRollout.findUniqueOrThrow({
			where: { id: rollout.id },
		});
		expect(record.archived).toBe(false);
		expect(record.outcome).toBeNull();
	});

	test('refuses (409) a conditional bake that would move ahead of an earlier test/rollout', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'search_v3', 'BOOL', {
			development: false,
			beta: false,
			production: false,
		});
		await seedRollout(app.id, 'a_earlier_rollout', {
			flagIds: [flag.id],
			rolloutValues: { production: { [flag.id]: false } },
		});
		const rollout = await seedRollout(app.id, 'b_later_rollout', {
			flagIds: [flag.id],
			conditions: [iosOnly],
			rolloutValues: { production: { [flag.id]: true } },
		});

		const res = await complete(rollout.id);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/"a_earlier_rollout" first/);
	});

	test('refuses (409) when the rollout value does not match the flag type', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'typed_flag', 'BOOL', {
			development: false,
			beta: false,
			production: false,
		});
		const rollout = await seedRollout(app.id, 'typed_rollout', {
			flagIds: [flag.id],
			rolloutValues: { production: { [flag.id]: 'yes' } },
		});

		const res = await complete(rollout.id);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/not a valid bool value/);
	});

	test('a failure mid-bake rolls back every flag and leaves the rollout active', async () => {
		const app = await seedApp();
		const first = await seedFlag(app.id, 'atomic_one', 'BOOL', {
			development: false,
			beta: false,
			production: false,
		});
		const second = await seedFlag(app.id, 'atomic_two', 'BOOL', {
			development: false,
			beta: false,
			production: false,
		});
		const rollout = await seedRollout(app.id, 'atomic_rollout', {
			flagIds: [first.id, second.id],
			rolloutValues: {
				production: { [first.id]: true, [second.id]: true },
			},
		});

		// Run the real transaction, but fail the second flag write: the first
		// write has already happened inside the transaction by then.
		type TxFn = (tx: Prisma.TransactionClient) => Promise<unknown>;
		const realTransaction = prisma.$transaction.bind(prisma) as unknown as (
			fn: TxFn,
			options?: unknown,
		) => Promise<unknown>;
		let flagWrites = 0;
		const spy = jest
			.spyOn(prisma, '$transaction')
			.mockImplementation((fn: TxFn, options?: unknown) =>
				realTransaction(async (tx) => {
					const flagDelegate = new Proxy(tx.flag, {
						get(target, prop) {
							if (prop === 'update') {
								return async (args: Prisma.FlagUpdateArgs) => {
									flagWrites += 1;
									if (flagWrites === 2) {
										throw new Error('injected mid-bake failure');
									}
									return target.update(args);
								};
							}
							return Reflect.get(target, prop) as unknown;
						},
					});
					const failingTx = new Proxy(tx, {
						get(target, prop) {
							return prop === 'flag'
								? flagDelegate
								: (Reflect.get(target, prop) as unknown);
						},
					});
					return fn(failingTx);
				}, options),
			);

		try {
			const res = await complete(rollout.id);
			expect(res.status).toBe(500);
		} finally {
			spy.mockRestore();
		}
		expect(flagWrites).toBe(2);

		for (const id of [first.id, second.id]) {
			const stored = await prisma.flag.findUniqueOrThrow({ where: { id } });
			expect(stored.defaultValues).toEqual({
				development: false,
				beta: false,
				production: false,
			});
		}
		const record = await prisma.testRollout.findUniqueOrThrow({
			where: { id: rollout.id },
		});
		expect(record.archived).toBe(false);
		expect(record.outcome).toBeNull();
		expect(record.percentage).toBe(25);
	});
});

describe('POST /api/test-rollouts/[id]/complete (tests)', () => {
	async function seedCheckoutTest(conditions: Condition[] = []) {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'checkout_button', 'STRING', {
			development: 'grey',
			beta: 'grey',
			production: 'grey',
		});
		const test = await seedTest(app.id, 'checkout_test', {
			flagIds: [flag.id],
			conditions,
			groups: {
				control: { production: { [flag.id]: 'grey' } },
				treatment: {
					beta: { [flag.id]: 'green' },
					production: { [flag.id]: 'green' },
				},
			},
		});
		return { app, flag, test };
	}

	test('bakes the winner group value as the default and records the winner', async () => {
		const { app, test } = await seedCheckoutTest();

		const res = await complete(test.id, { winner: 'treatment' });
		expect(res.status).toBe(200);
		const body = (await res.json()) as { outcome: string; winner: string };
		expect(body.outcome).toBe('COMPLETED');
		expect(body.winner).toBe('treatment');

		const after = await generateConfigFromDb(app.id);
		expect(after.flags.checkout_button.production.default).toBe('green');
		expect(after.flags.checkout_button.beta.default).toBe('green');
		expect(after.flags.checkout_button.development.default).toBe('grey');
		expect(after.flags.checkout_button.production.variants).toEqual([]);
		expect(after.tests).toEqual({});
	});

	test('with entry conditions: bakes the winner value as a conditional variant', async () => {
		const { app, test } = await seedCheckoutTest([iosOnly]);

		const res = await complete(test.id, { winner: 'treatment' });
		expect(res.status).toBe(200);

		const after = await generateConfigFromDb(app.id);
		const prod = after.flags.checkout_button.production;
		expect(prod.default).toBe('grey');
		expect(prod.variants).toEqual([
			{
				type: 'conditional',
				order: 1,
				value: 'green',
				conditions: [iosOnly],
			},
		]);
	});

	test('refuses (409) a winner with no value where other groups have one', async () => {
		const { test } = await seedCheckoutTest();

		// control has no beta value; treatment does.
		const res = await complete(test.id, { winner: 'control' });
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/no value for group "control"/);
	});

	test.each([
		['a missing', undefined],
		['an empty', { winner: '' }],
		['an unknown', { winner: 'variant_c' }],
	])('rejects %s winner with 400 and changes nothing', async (_, body) => {
		const { flag, test } = await seedCheckoutTest();

		const res = await complete(test.id, body);
		expect(res.status).toBe(400);

		const record = await prisma.testRollout.findUniqueOrThrow({
			where: { id: test.id },
		});
		expect(record.archived).toBe(false);
		expect(record.outcome).toBeNull();
		const stored = await prisma.flag.findUniqueOrThrow({
			where: { id: flag.id },
		});
		expect(stored.defaultValues).toEqual({
			development: 'grey',
			beta: 'grey',
			production: 'grey',
		});
	});
});

describe('POST /api/test-rollouts/[id]/archive (abandon)', () => {
	test('archives without baking: users get the flag default again', async () => {
		const app = await seedApp();
		const flag = await seedFlag(app.id, 'dark_mode', 'BOOL', {
			development: false,
			beta: false,
			production: false,
		});
		const rollout = await seedRollout(app.id, 'dark_mode_rollout', {
			flagIds: [flag.id],
			percentage: 60,
			rolloutValues: { production: { [flag.id]: true } },
		});

		const res = await abandon(rollout.id);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			archived: boolean;
			outcome: string;
			percentage: number;
			completedAt: string | null;
		};
		expect(body.archived).toBe(true);
		expect(body.outcome).toBe('ABANDONED');
		expect(body.percentage).toBe(0);
		expect(body.completedAt).toBeNull();

		const after = await generateConfigFromDb(app.id);
		expect(after.flags.dark_mode.production.default).toBe(false);
		expect(after.flags.dark_mode.production.variants).toEqual([]);
		expect(after.rollouts).toEqual({});
	});

	test('no longer completes: type "complete" is rejected', async () => {
		const app = await seedApp();
		const rollout = await seedRollout(app.id, 'legacy_rollout', {
			flagIds: [],
			rolloutValues: {},
		});

		const res = await abandon(rollout.id, { type: 'complete' });
		expect(res.status).toBe(400);
		const record = await prisma.testRollout.findUniqueOrThrow({
			where: { id: rollout.id },
		});
		expect(record.archived).toBe(false);
	});

	test('a finished test/rollout cannot be finished again or reactivated', async () => {
		const app = await seedApp();
		const rollout = await seedRollout(app.id, 'finished_rollout', {
			flagIds: [],
			rolloutValues: {},
		});

		expect((await complete(rollout.id)).status).toBe(200);
		expect((await abandon(rollout.id)).status).toBe(409);
		expect((await complete(rollout.id)).status).toBe(409);

		const res = await putTestRollout(
			new NextRequest(`http://local/api/test-rollouts/${rollout.id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: 'Back again' }),
			}),
			ctx(rollout.id),
		);
		expect(res.status).toBe(409);
		const record = await prisma.testRollout.findUniqueOrThrow({
			where: { id: rollout.id },
		});
		expect(record.archived).toBe(true);
		expect(record.outcome).toBe('COMPLETED');
	});
});
