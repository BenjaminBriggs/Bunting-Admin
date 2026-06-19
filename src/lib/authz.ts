/**
 * Node-runtime authorization helpers.
 *
 * Authentication is enforced globally in edge middleware (`src/middleware.ts`),
 * but authorization (role checks) cannot run there because Prisma is node-only.
 * These helpers resolve the request identity to a role and gate handlers.
 * See ../docs/authentication.md §Roles for the ADMIN vs DEVELOPER policy.
 */

import { NextResponse } from 'next/server';
import { getUserRoleFromAccessList } from './access-control';
import { resolveAuthConfig } from './auth-env';
import { identityFromHeaders } from './auth-session';

export type Role = 'ADMIN' | 'DEVELOPER';

/**
 * Resolve the request's identity and role, or null if unauthenticated.
 *
 * - **oidc**: the NextAuth session carries the authoritative role, assigned at
 *   sign-in (first-user ADMIN bootstrap, then the access-list role). This is the
 *   same role the UI uses to gate admin features, so the API must trust it too —
 *   re-deriving from the `User` table would wrongly deny a valid admin whose row
 *   is missing (e.g. a JWT that outlived a DB reset).
 * - **proxy**: no NextAuth session exists; resolve the role from the access list
 *   by the proxied email (the documented role source for that mode).
 *
 * See ../docs/authentication.md §Access control.
 */
export async function getRequestRole(
	headers: Headers,
): Promise<{ email: string; role: Role } | null> {
	const config = resolveAuthConfig();

	if (config.mode === 'proxy') {
		const identity = await identityFromHeaders(headers, config);
		if (!identity) {
			return null;
		}
		const role = await getUserRoleFromAccessList(identity.email);
		return { email: identity.email, role };
	}

	// oidc: read the role straight off the NextAuth session.
	const { auth } = await import('./auth');
	const session = await auth();
	const sessionUser = session?.user;
	if (!sessionUser?.email) {
		return null;
	}
	const email = sessionUser.email.trim().toLowerCase();
	const role: Role = sessionUser.role === 'ADMIN' ? 'ADMIN' : 'DEVELOPER';
	return { email, role };
}

/**
 * Gate a handler on the ADMIN role. Returns the identity on success, or a
 * `NextResponse` (401/403) the caller should return directly:
 *
 *   const authz = await requireAdmin(request.headers);
 *   if (authz instanceof NextResponse) return authz;
 *   // authz.email is the authenticated admin
 */
export async function requireAdmin(
	headers: Headers,
): Promise<{ email: string } | NextResponse> {
	const ctx = await getRequestRole(headers);
	if (!ctx) {
		return NextResponse.json(
			{ error: 'Authentication required' },
			{ status: 401 },
		);
	}
	if (ctx.role !== 'ADMIN') {
		return NextResponse.json(
			{ error: 'Forbidden: admin role required' },
			{ status: 403 },
		);
	}
	return { email: ctx.email };
}
