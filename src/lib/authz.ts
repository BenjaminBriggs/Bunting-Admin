/**
 * Node-runtime authorization helpers.
 *
 * Authentication is enforced globally in edge middleware (`src/middleware.ts`),
 * but authorization (role checks) cannot run there because Prisma is node-only.
 * These helpers resolve the request identity to a role and gate handlers.
 *
 * The role source of truth is the `User` table, which is authoritative in both
 * `oidc` and `proxy` auth modes. See ../docs/authentication.md §Roles for the
 * ADMIN vs DEVELOPER policy.
 */

import { NextResponse } from 'next/server';
import { identityFromRequest } from './auth-session';
import { db } from './db';

export type Role = 'ADMIN' | 'DEVELOPER';

/** Resolve the request's identity and role, or null if unauthenticated. */
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

	return { email: identity.email, role: user?.role ?? 'DEVELOPER' };
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
