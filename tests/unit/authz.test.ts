type Role = 'ADMIN' | 'DEVELOPER';
type Identity = { email: string } | null;
type Session = { user?: { email?: string | null; role?: string } } | null;
type AuthConfig = { mode: 'oidc' | 'proxy' };

const mockResolveAuthConfig = jest.fn<AuthConfig, []>();
const mockAuth = jest.fn<Promise<Session>, []>();
const mockIdentityFromHeaders = jest.fn<
	Promise<Identity>,
	[Headers, AuthConfig]
>();
const mockRoleFromAccessList = jest.fn<Promise<Role>, [string]>();

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

// Imported after the jest.mock calls so the mocked dependencies register first.
// eslint-disable-next-line import/first -- jest.mock must register before import
import { NextResponse } from 'next/server';
// eslint-disable-next-line import/first -- jest.mock must register before import
import { getRequestRole, requireAdmin } from '@/lib/authz';

const headers = new Headers();

beforeEach(() => {
	mockResolveAuthConfig.mockReset();
	mockAuth.mockReset();
	mockIdentityFromHeaders.mockReset();
	mockRoleFromAccessList.mockReset();
	mockResolveAuthConfig.mockReturnValue({ mode: 'oidc' });
});

describe('getRequestRole — oidc mode (session role)', () => {
	it('returns null when there is no session', async () => {
		mockAuth.mockResolvedValue(null);
		expect(await getRequestRole(headers)).toBeNull();
	});

	it('returns ADMIN straight off the session role', async () => {
		mockAuth.mockResolvedValue({ user: { email: 'A@x.com', role: 'ADMIN' } });
		expect(await getRequestRole(headers)).toEqual({
			email: 'a@x.com',
			role: 'ADMIN',
		});
	});

	it('treats a missing/non-admin session role as DEVELOPER', async () => {
		mockAuth.mockResolvedValue({ user: { email: 'dev@x.com' } });
		expect(await getRequestRole(headers)).toEqual({
			email: 'dev@x.com',
			role: 'DEVELOPER',
		});
	});
});

describe('getRequestRole — proxy mode (access list)', () => {
	beforeEach(() => {
		mockResolveAuthConfig.mockReturnValue({ mode: 'proxy' });
	});

	it('returns null when the proxy provides no identity', async () => {
		mockIdentityFromHeaders.mockResolvedValue(null);
		expect(await getRequestRole(headers)).toBeNull();
	});

	it('resolves the role from the access list', async () => {
		mockIdentityFromHeaders.mockResolvedValue({ email: 'proxy@x.com' });
		mockRoleFromAccessList.mockResolvedValue('ADMIN');
		expect(await getRequestRole(headers)).toEqual({
			email: 'proxy@x.com',
			role: 'ADMIN',
		});
		expect(mockRoleFromAccessList).toHaveBeenCalledWith('proxy@x.com');
	});
});

describe('requireAdmin', () => {
	it('returns 401 when unauthenticated', async () => {
		mockAuth.mockResolvedValue(null);
		const result = await requireAdmin(headers);
		expect(result).toBeInstanceOf(NextResponse);
		expect((result as NextResponse).status).toBe(401);
	});

	it('returns 403 for a DEVELOPER', async () => {
		mockAuth.mockResolvedValue({
			user: { email: 'dev@x.com', role: 'DEVELOPER' },
		});
		const result = await requireAdmin(headers);
		expect(result).toBeInstanceOf(NextResponse);
		expect((result as NextResponse).status).toBe(403);
	});

	it('returns the identity for an ADMIN', async () => {
		mockAuth.mockResolvedValue({
			user: { email: 'admin@x.com', role: 'ADMIN' },
		});
		const result = await requireAdmin(headers);
		expect(result).toEqual({ email: 'admin@x.com' });
	});
});
