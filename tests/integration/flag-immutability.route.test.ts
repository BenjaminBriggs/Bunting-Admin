import { NextRequest } from 'next/server';
import { PUT as putFlag } from '@/app/api/flags/[id]/route';
import { PUT as putRollout } from '@/app/api/rollouts/[id]/route';
import { PUT as putTestRollout } from '@/app/api/test-rollouts/[id]/route';
import { PUT as putTest } from '@/app/api/tests/[id]/route';
import { prisma } from '@/lib/db';

// Keys and types are immutable from creation: apps ship generated, strongly
// typed accessors for flag keys/types, and the artifact references tests and
// rollouts by key.

let seq = 0;

async function seedApp() {
	seq += 1;
	return prisma.app.create({
		data: {
			name: 'Immutability App',
			identifier: `immutability-${seq}`,
			artifactUrl: `https://cdn.example.com/immutability-${seq}/`,
			publicKeys: [],
			fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
			storageConfig: {},
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

describe('PUT /api/flags/[id] key and type immutability', () => {
	async function seedFlag() {
		const app = await seedApp();
		return prisma.flag.create({
			data: {
				appId: app.id,
				key: 'store/new_paywall',
				displayName: 'New Paywall',
				type: 'BOOL',
				defaultValues: { development: true, beta: false, production: false },
				variants: { development: [], beta: [], production: [] },
			},
		});
	}

	test('accepts the identical key and type (what the edit form sends)', async () => {
		const flag = await seedFlag();

		const res = await putFlag(
			put(`/api/flags/${flag.id}`, {
				key: 'store/new_paywall',
				type: 'bool',
				displayName: 'Renamed Paywall',
				defaultValues: { development: true, beta: true, production: false },
			}),
			ctx(flag.id),
		);

		expect(res.status).toBe(200);
		const stored = await prisma.flag.findUniqueOrThrow({
			where: { id: flag.id },
		});
		expect(stored.key).toBe('store/new_paywall');
		expect(stored.type).toBe('BOOL');
		expect(stored.displayName).toBe('Renamed Paywall');
		expect(stored.defaultValues).toEqual({
			development: true,
			beta: true,
			production: false,
		});
	});

	test('rejects a changed key with 409 and writes nothing', async () => {
		const flag = await seedFlag();

		const res = await putFlag(
			put(`/api/flags/${flag.id}`, {
				key: 'store/renamed_paywall',
				displayName: 'Should Not Apply',
			}),
			ctx(flag.id),
		);

		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/key cannot be changed/);
		const stored = await prisma.flag.findUniqueOrThrow({
			where: { id: flag.id },
		});
		expect(stored.key).toBe('store/new_paywall');
		expect(stored.displayName).toBe('New Paywall');
	});

	test('rejects a changed type with 409 and writes nothing', async () => {
		const flag = await seedFlag();

		const res = await putFlag(
			put(`/api/flags/${flag.id}`, {
				type: 'string',
				defaultValues: { development: 'a', beta: 'b', production: 'c' },
			}),
			ctx(flag.id),
		);

		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/type cannot be changed/);
		const stored = await prisma.flag.findUniqueOrThrow({
			where: { id: flag.id },
		});
		expect(stored.type).toBe('BOOL');
		expect(stored.defaultValues).toEqual({
			development: true,
			beta: false,
			production: false,
		});
	});
});

describe('test and rollout keys cannot be renamed through any update route', () => {
	async function seedTestRollout(type: 'TEST' | 'ROLLOUT') {
		const app = await seedApp();
		return prisma.testRollout.create({
			data: {
				appId: app.id,
				key: type === 'TEST' ? 'checkout_test' : 'checkout_rollout',
				name: 'Checkout',
				type,
				salt: 'salt_checkout',
				percentage: type === 'ROLLOUT' ? 10 : null,
				variants:
					type === 'TEST'
						? {
								control: { percentage: 50, values: {} },
								treatment: { percentage: 50, values: {} },
							}
						: undefined,
			},
		});
	}

	test('PUT /api/tests/[id] ignores key', async () => {
		const test = await seedTestRollout('TEST');

		const res = await putTest(
			put(`/api/tests/${test.id}`, { key: 'renamed_test', name: 'New name' }),
			ctx(test.id),
		);

		expect(res.status).toBe(200);
		const stored = await prisma.testRollout.findUniqueOrThrow({
			where: { id: test.id },
		});
		expect(stored.key).toBe('checkout_test');
		expect(stored.name).toBe('New name');
	});

	test('PUT /api/rollouts/[id] ignores key', async () => {
		const rollout = await seedTestRollout('ROLLOUT');

		const res = await putRollout(
			put(`/api/rollouts/${rollout.id}`, {
				key: 'renamed_rollout',
				name: 'New name',
			}),
			ctx(rollout.id),
		);

		expect(res.status).toBe(200);
		const stored = await prisma.testRollout.findUniqueOrThrow({
			where: { id: rollout.id },
		});
		expect(stored.key).toBe('checkout_rollout');
		expect(stored.name).toBe('New name');
	});

	test('PUT /api/test-rollouts/[id] ignores key', async () => {
		const rollout = await seedTestRollout('ROLLOUT');

		const res = await putTestRollout(
			put(`/api/test-rollouts/${rollout.id}`, {
				key: 'renamed_rollout',
				name: 'New name',
				percentage: 10,
			}),
			ctx(rollout.id),
		);

		expect(res.status).toBe(200);
		const stored = await prisma.testRollout.findUniqueOrThrow({
			where: { id: rollout.id },
		});
		expect(stored.key).toBe('checkout_rollout');
		expect(stored.name).toBe('New name');
	});
});
