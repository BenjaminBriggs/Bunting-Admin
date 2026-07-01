type Role = 'ADMIN' | 'DEVELOPER';
type Identity = { email: string } | null;
type Session = {
	user?: { id?: string; email?: string | null; role?: string };
} | null;
type AuthConfig = { mode: 'oidc' | 'proxy' };

const mockResolveAuthConfig = jest.fn<AuthConfig, []>();
const mockAuth = jest.fn<Promise<Session>, []>();
const mockIdentityFromHeaders = jest.fn<
	Promise<Identity>,
	[Headers, AuthConfig]
>();
const mockRoleFromAccessList = jest.fn<Promise<Role>, [string]>();
const mockFindMany = jest.fn<Promise<unknown[]>, unknown[]>();
const mockFindUnique = jest.fn<Promise<{ email: string } | null>, unknown[]>();
const mockUpdate = jest.fn<
	Promise<{ id: string; email: string; role: Role }>,
	unknown[]
>();
const mockLogActivity = jest.fn<Promise<void>, unknown[]>();

jest.mock('@/lib/auth-env', () => ({
	resolveAuthConfig: (): AuthConfig => mockResolveAuthConfig(),
}));

jest.mock('@/lib/auth', () => ({
	auth: (): Promise<Session> => mockAuth(),
}));

jest.mock('@/lib/auth-session', () => ({
	identityFromHeaders: (
		headers: Headers,
		config: AuthConfig,
	): Promise<Identity> => mockIdentityFromHeaders(headers, config),
}));

jest.mock('@/lib/access-control', () => ({
	getUserRoleFromAccessList: (email: string): Promise<Role> =>
		mockRoleFromAccessList(email),
}));

jest.mock('@/lib/db', () => ({
	db: {
		user: {
			findMany: (...args: unknown[]) => mockFindMany(...args),
			findUnique: (...args: unknown[]) => mockFindUnique(...args),
			update: (...args: unknown[]) => mockUpdate(...args),
		},
	},
}));

jest.mock('@/lib/activity-log', () => ({
	logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

// Imported after the jest.mock calls so the mocked dependencies register first.
// eslint-disable-next-line import/first -- jest.mock must register before import
import { NextRequest } from 'next/server';
// eslint-disable-next-line import/first -- jest.mock must register before import
import { GET, PATCH } from '@/app/api/users/route';

function req(): NextRequest {
	return new NextRequest('http://local/api/users');
}

function patchReq(body: unknown): NextRequest {
	return new NextRequest('http://local/api/users', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	mockResolveAuthConfig.mockReset();
	mockAuth.mockReset();
	mockIdentityFromHeaders.mockReset();
	mockRoleFromAccessList.mockReset();
	mockFindMany.mockReset();
	mockFindUnique.mockReset();
	mockUpdate.mockReset();
	mockLogActivity.mockReset();
	mockResolveAuthConfig.mockReturnValue({ mode: 'oidc' });
	mockFindMany.mockResolvedValue([]);
});

describe('GET /api/users — session mode (oidc)', () => {
	it('allows an ADMIN session', async () => {
		mockAuth.mockResolvedValue({
			user: { email: 'admin@x.com', role: 'ADMIN' },
		});
		const res = await GET(req());
		expect(res.status).toBe(200);
		expect(mockFindMany).toHaveBeenCalled();
	});

	it('rejects a DEVELOPER session', async () => {
		mockAuth.mockResolvedValue({
			user: { email: 'dev@x.com', role: 'DEVELOPER' },
		});
		const res = await GET(req());
		expect(res.status).toBe(403);
		expect(mockFindMany).not.toHaveBeenCalled();
	});

	it('rejects when unauthenticated', async () => {
		mockAuth.mockResolvedValue(null);
		const res = await GET(req());
		expect(res.status).toBe(401);
		expect(mockFindMany).not.toHaveBeenCalled();
	});
});

describe('GET /api/users — proxy mode', () => {
	beforeEach(() => {
		mockResolveAuthConfig.mockReturnValue({ mode: 'proxy' });
	});

	it('allows an ADMIN resolved from the access list', async () => {
		mockIdentityFromHeaders.mockResolvedValue({ email: 'admin@x.com' });
		mockRoleFromAccessList.mockResolvedValue('ADMIN');
		const res = await GET(req());
		expect(res.status).toBe(200);
		expect(mockFindMany).toHaveBeenCalled();
	});

	it('rejects a non-admin resolved from the access list', async () => {
		mockIdentityFromHeaders.mockResolvedValue({ email: 'dev@x.com' });
		mockRoleFromAccessList.mockResolvedValue('DEVELOPER');
		const res = await GET(req());
		expect(res.status).toBe(403);
		expect(mockFindMany).not.toHaveBeenCalled();
	});

	it('rejects when the proxy provides no identity', async () => {
		mockIdentityFromHeaders.mockResolvedValue(null);
		const res = await GET(req());
		expect(res.status).toBe(401);
		expect(mockFindMany).not.toHaveBeenCalled();
	});
});

describe('PATCH /api/users — proxy mode', () => {
	beforeEach(() => {
		mockResolveAuthConfig.mockReturnValue({ mode: 'proxy' });
	});

	it('allows an admin to change another user (id-based lookup, no session id needed)', async () => {
		mockIdentityFromHeaders.mockResolvedValue({ email: 'admin@x.com' });
		mockRoleFromAccessList.mockResolvedValue('ADMIN');
		mockFindUnique.mockResolvedValue({ email: 'someone-else@x.com' });
		mockUpdate.mockResolvedValue({
			id: 'u2',
			email: 'someone-else@x.com',
			role: 'DEVELOPER',
		});

		const res = await PATCH(patchReq({ userId: 'u2', role: 'DEVELOPER' }));

		expect(res.status).toBe(200);
		expect(mockFindUnique).toHaveBeenCalledWith({
			where: { id: 'u2' },
			select: { email: true },
		});
		expect(mockUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'u2' },
				data: { role: 'DEVELOPER' },
			}),
		);
	});

	it('rejects an admin demoting themselves, matched by email since proxy mode has no session id', async () => {
		mockIdentityFromHeaders.mockResolvedValue({ email: 'admin@x.com' });
		mockRoleFromAccessList.mockResolvedValue('ADMIN');
		mockFindUnique.mockResolvedValue({ email: 'admin@x.com' });

		const res = await PATCH(patchReq({ userId: 'self-id', role: 'DEVELOPER' }));

		expect(res.status).toBe(400);
		expect(mockUpdate).not.toHaveBeenCalled();
		expect(mockLogActivity).not.toHaveBeenCalled();
	});
});

describe('PATCH /api/users — session mode (oidc)', () => {
	it('rejects an admin demoting themselves (defensive case-insensitive email match)', async () => {
		mockAuth.mockResolvedValue({
			user: { email: 'admin@x.com', role: 'ADMIN' },
		});
		// authz.ts normalizes the session email to lowercase; the DB row is
		// deliberately mixed-case here to exercise the defensive
		// target.email.toLowerCase() comparison in the route.
		mockFindUnique.mockResolvedValue({ email: 'ADMIN@X.COM' });

		const res = await PATCH(patchReq({ userId: 'self-id', role: 'DEVELOPER' }));

		expect(res.status).toBe(400);
		expect(mockUpdate).not.toHaveBeenCalled();
	});
});
