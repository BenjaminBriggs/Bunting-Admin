import { NextResponse } from 'next/server';

const mockIdentityFromRequest = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('@/lib/auth-session', () => ({
	identityFromRequest: (headers: Headers) => mockIdentityFromRequest(headers),
}));

jest.mock('@/lib/db', () => ({
	db: { user: { findUnique: (args: unknown) => mockFindUnique(args) } },
}));

import { getRequestRole, requireAdmin } from '@/lib/authz';

const headers = new Headers();

beforeEach(() => {
	mockIdentityFromRequest.mockReset();
	mockFindUnique.mockReset();
});

describe('getRequestRole', () => {
	it('returns null when unauthenticated', async () => {
		mockIdentityFromRequest.mockResolvedValue(null);
		expect(await getRequestRole(headers)).toBeNull();
		expect(mockFindUnique).not.toHaveBeenCalled();
	});

	it('returns the role from the User table', async () => {
		mockIdentityFromRequest.mockResolvedValue({ email: 'a@x.com' });
		mockFindUnique.mockResolvedValue({ role: 'ADMIN' });
		expect(await getRequestRole(headers)).toEqual({
			email: 'a@x.com',
			role: 'ADMIN',
		});
	});

	it('defaults to DEVELOPER when no User row exists', async () => {
		mockIdentityFromRequest.mockResolvedValue({ email: 'ghost@x.com' });
		mockFindUnique.mockResolvedValue(null);
		expect(await getRequestRole(headers)).toEqual({
			email: 'ghost@x.com',
			role: 'DEVELOPER',
		});
	});
});

describe('requireAdmin', () => {
	it('returns 401 when unauthenticated', async () => {
		mockIdentityFromRequest.mockResolvedValue(null);
		const result = await requireAdmin(headers);
		expect(result).toBeInstanceOf(NextResponse);
		expect((result as NextResponse).status).toBe(401);
	});

	it('returns 403 for a DEVELOPER', async () => {
		mockIdentityFromRequest.mockResolvedValue({ email: 'dev@x.com' });
		mockFindUnique.mockResolvedValue({ role: 'DEVELOPER' });
		const result = await requireAdmin(headers);
		expect(result).toBeInstanceOf(NextResponse);
		expect((result as NextResponse).status).toBe(403);
	});

	it('returns the identity for an ADMIN', async () => {
		mockIdentityFromRequest.mockResolvedValue({ email: 'admin@x.com' });
		mockFindUnique.mockResolvedValue({ role: 'ADMIN' });
		const result = await requireAdmin(headers);
		expect(result).toEqual({ email: 'admin@x.com' });
	});
});
