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
const mockAccessFindFirst = jest.fn<Promise<unknown>, unknown[]>();
const mockUserFindUnique = jest.fn<Promise<{ id: string } | null>, unknown[]>();
type AccessEntry = {
	id: string;
	type: 'EMAIL' | 'DOMAIN';
	value: string;
	role: Role;
	createdBy: { id: string; email: string; name: string | null } | null;
};
const mockAccessCreate = jest.fn<Promise<AccessEntry>, unknown[]>();
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
		accessList: {
			findMany: (...args: unknown[]) => mockFindMany(...args),
			findFirst: (...args: unknown[]) => mockAccessFindFirst(...args),
			create: (...args: unknown[]) => mockAccessCreate(...args),
		},
		user: {
			findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
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
import { GET, POST } from '@/app/api/access-list/route';

function req(): NextRequest {
	return new NextRequest('http://local/api/access-list');
}

function postReq(body: unknown): NextRequest {
	return new NextRequest('http://local/api/access-list', {
		method: 'POST',
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
	mockAccessFindFirst.mockReset();
	mockUserFindUnique.mockReset();
	mockAccessCreate.mockReset();
	mockLogActivity.mockReset();
	mockResolveAuthConfig.mockReturnValue({ mode: 'oidc' });
	mockFindMany.mockResolvedValue([]);
	mockAccessFindFirst.mockResolvedValue(null);
});

describe('GET /api/access-list — session mode (oidc)', () => {
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

describe('GET /api/access-list — proxy mode', () => {
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

describe('POST /api/access-list — proxy mode', () => {
	beforeEach(() => {
		mockResolveAuthConfig.mockReturnValue({ mode: 'proxy' });
	});

	it('succeeds with a null creator when the proxy admin has no User row', async () => {
		mockIdentityFromHeaders.mockResolvedValue({ email: 'admin@x.com' });
		mockRoleFromAccessList.mockResolvedValue('ADMIN');
		// No NextAuth sign-in ever happened for this proxy identity, so there's
		// no matching User row — createdById must fall back to undefined/null
		// rather than throwing or 500ing.
		mockUserFindUnique.mockResolvedValue(null);
		mockAccessCreate.mockResolvedValue({
			id: 'a1',
			type: 'EMAIL',
			value: 'new@x.com',
			role: 'DEVELOPER',
			createdBy: null,
		});

		const res = await POST(
			postReq({ type: 'EMAIL', value: 'new@x.com', role: 'DEVELOPER' }),
		);

		expect(res.status).toBe(200);
		const json = (await res.json()) as AccessEntry;
		expect(json.createdBy).toBeNull();
		expect(mockUserFindUnique).toHaveBeenCalledWith({
			where: { email: 'admin@x.com' },
			select: { id: true },
		});
		expect(mockAccessCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					type: 'EMAIL',
					value: 'new@x.com',
					role: 'DEVELOPER',
					createdById: undefined,
				},
			}),
		);
	});
});

describe('POST /api/access-list — session mode (oidc)', () => {
	it('populates createdBy when the actor has a matching User row', async () => {
		mockAuth.mockResolvedValue({
			user: { email: 'admin@x.com', role: 'ADMIN' },
		});
		mockUserFindUnique.mockResolvedValue({ id: 'user-1' });
		mockAccessCreate.mockResolvedValue({
			id: 'a2',
			type: 'EMAIL',
			value: 'new2@x.com',
			role: 'DEVELOPER',
			createdBy: { id: 'user-1', email: 'admin@x.com', name: null },
		});

		const res = await POST(
			postReq({ type: 'EMAIL', value: 'new2@x.com', role: 'DEVELOPER' }),
		);

		expect(res.status).toBe(200);
		const json = (await res.json()) as AccessEntry;
		expect(json.createdBy).toEqual({
			id: 'user-1',
			email: 'admin@x.com',
			name: null,
		});
		expect(mockAccessCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					type: 'EMAIL',
					value: 'new2@x.com',
					role: 'DEVELOPER',
					createdById: 'user-1',
				},
			}),
		);
	});
});
