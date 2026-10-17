import { NextRequest } from 'next/server';
import { GET } from '@/app/api/me/route';
import { prisma } from '@/lib/db';

// Proxy auth mode has no NextAuth client session, so the UI asks the server
// for the caller's role. It must come from the access list, like requireAdmin.
describe('GET /api/me (proxy mode)', () => {
	const savedEnv = { ...process.env };

	beforeAll(() => {
		process.env.AUTH_MODE = 'proxy';
		delete process.env.AUTH_PROXY_JWKS_URL;
		delete process.env.AUTH_PROXY_EMAIL_HEADER;
	});

	afterAll(() => {
		process.env = savedEnv;
	});

	beforeEach(async () => {
		await prisma.accessList.createMany({
			data: [
				{ type: 'EMAIL', value: 'admin@example.com', role: 'ADMIN' },
				{ type: 'DOMAIN', value: '@example.com', role: 'DEVELOPER' },
			],
		});
	});

	const get = (email?: string) =>
		GET(
			new NextRequest('http://local/api/me', {
				headers: email ? { 'x-forwarded-email': email } : {},
			}),
		);

	test('returns the role resolved from the access list', async () => {
		const admin = await get('Admin@Example.com');
		expect(admin.status).toBe(200);
		expect(admin.headers.get('cache-control')).toBe('private, no-store');
		expect(await admin.json()).toEqual({
			email: 'admin@example.com',
			role: 'ADMIN',
			name: null,
			image: null,
			authMode: 'proxy',
		});

		const dev = await get('someone@example.com');
		expect(dev.status).toBe(200);
		expect(await dev.json()).toEqual({
			email: 'someone@example.com',
			role: 'DEVELOPER',
			name: null,
			image: null,
			authMode: 'proxy',
		});
	});

	test('includes the display name of a known user row', async () => {
		await prisma.user.create({
			data: { email: 'admin@example.com', name: 'Ada Admin' },
		});
		const res = await get('admin@example.com');
		expect(await res.json()).toMatchObject({
			email: 'admin@example.com',
			role: 'ADMIN',
			name: 'Ada Admin',
		});
	});

	test('returns 401 without a proxy identity', async () => {
		const res = await get();
		expect(res.status).toBe(401);
	});
});
