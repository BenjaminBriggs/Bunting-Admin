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
	db: { user: { findMany: (...args: unknown[]) => mockFindMany(...args) } },
}));

jest.mock('@/lib/activity-log', () => ({
	logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

// Imported after the jest.mock calls so the mocked dependencies register first.
// eslint-disable-next-line import/first -- jest.mock must register before import
import { NextRequest } from 'next/server';
// eslint-disable-next-line import/first -- jest.mock must register before import
import { GET } from '@/app/api/users/route';

function req(): NextRequest {
	return new NextRequest('http://local/api/users');
}

beforeEach(() => {
	mockResolveAuthConfig.mockReset();
	mockAuth.mockReset();
	mockIdentityFromHeaders.mockReset();
	mockRoleFromAccessList.mockReset();
	mockFindMany.mockReset();
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
