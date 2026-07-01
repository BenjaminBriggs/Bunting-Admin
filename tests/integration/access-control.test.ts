import { bootstrapFirstProxyAdmin } from '@/lib/access-control';
import { prisma } from '@/lib/db';

describe('bootstrapFirstProxyAdmin (integration)', () => {
	test('grants ADMIN to the first proxy user and declines on subsequent calls', async () => {
		const first = await bootstrapFirstProxyAdmin('first@example.com');
		expect(first).toBe('ADMIN');

		const entry = await prisma.accessList.findUnique({
			where: { type_value: { type: 'EMAIL', value: 'first@example.com' } },
		});
		expect(entry?.role).toBe('ADMIN');

		const second = await bootstrapFirstProxyAdmin('second@example.com');
		expect(second).toBeNull();

		const secondEntry = await prisma.accessList.findUnique({
			where: { type_value: { type: 'EMAIL', value: 'second@example.com' } },
		});
		expect(secondEntry).toBeNull();
	});

	// Two different, never-before-seen proxy identities racing the very first
	// request against a fresh install. Only one may become ADMIN — the
	// pg_advisory_xact_lock inside the transaction must serialize the
	// check-and-insert so the second caller observes a non-empty access list.
	test('is race-safe: concurrent first requests from different identities do not both bootstrap', async () => {
		const [a, b] = await Promise.all([
			bootstrapFirstProxyAdmin('racer-a@example.com'),
			bootstrapFirstProxyAdmin('racer-b@example.com'),
		]);

		const results = [a, b].filter((r) => r === 'ADMIN');
		expect(results).toHaveLength(1);

		const rows = await prisma.accessList.findMany();
		expect(rows).toHaveLength(1);
	});

	test('does not bootstrap when an ADMIN user row already exists (mixed oidc/proxy)', async () => {
		await prisma.user.create({
			data: { email: 'oidc-admin@example.com', role: 'ADMIN' },
		});

		const role = await bootstrapFirstProxyAdmin('proxy-user@example.com');

		expect(role).toBeNull();
		const rows = await prisma.accessList.findMany();
		expect(rows).toHaveLength(0);
	});
});
