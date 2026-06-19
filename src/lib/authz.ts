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
import { identityFromRequest } from './auth-session';
import { db } from './db';

export type Role = 'ADMIN' | 'DEVELOPER';

/**
 * Resolve the request's identity and role, or null if unauthenticated.
 *
 * The `User` table is the role source in oidc mode (populated at sign-in,
 * including the first-user ADMIN bootstrap). In proxy mode no `User` row is
 * created, so we fall back to the access list — the documented role source for
 * both modes (see ../docs/authentication.md §Access control).
 */
export async function getRequestRole(
	headers: Headers,
): Promise<{ email: string; role: Role } | null> {
	const identity = await identityFromRequest(headers);
	if (!identity) {
		return null;
	}

	const user = await db.user.findUnique({
		where: { email: identity.email },
		select: { role: true },
	});
	if (user) {
		return { email: identity.email, role: user.role };
	}

	const role = await getUserRoleFromAccessList(identity.email);
	return { email: identity.email, role };
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
