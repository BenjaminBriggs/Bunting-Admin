import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveAuthConfig } from '@/lib/auth-env';
import { getRequestRole } from '@/lib/authz';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET /api/me - The caller's identity and role, resolved server-side the same
// way route authorization does (NextAuth session in oidc mode, access list in
// proxy mode). The UI uses it for every client-side identity decision (sign-in
// redirects, the user menu, which admin controls to show) because proxy mode
// has no NextAuth client session. It grants nothing by itself: every admin
// route still checks requireAdmin.
export async function GET(request: NextRequest) {
	try {
		const ctx = await getRequestRole(request.headers);
		if (!ctx) {
			return NextResponse.json(
				{ error: 'Authentication required' },
				{ status: 401 },
			);
		}
		// Display name/avatar exist only for users who signed in via OIDC.
		const user = await prisma.user.findUnique({
			where: { email: ctx.email },
			select: { name: true, image: true },
		});
		return NextResponse.json(
			{
				email: ctx.email,
				role: ctx.role,
				name: user?.name ?? null,
				image: user?.image ?? null,
				authMode: resolveAuthConfig().mode,
			},
			{ headers: { 'Cache-Control': 'private, no-store' } },
		);
	} catch (error) {
		logger.error({ err: error }, 'Failed to resolve current user');
		return NextResponse.json(
			{ error: 'Failed to resolve current user' },
			{ status: 500 },
		);
	}
}
