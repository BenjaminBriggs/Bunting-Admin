import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/authz';
import { logger } from '@/lib/logger';

// GET /api/me - The caller's identity and role, resolved server-side the same
// way route authorization does (NextAuth session in oidc mode, access list in
// proxy mode). The UI uses it to decide which admin controls to show; it grants
// nothing by itself, since every admin route still checks requireAdmin.
export async function GET(request: NextRequest) {
	try {
		const ctx = await getRequestRole(request.headers);
		if (!ctx) {
			return NextResponse.json(
				{ error: 'Authentication required' },
				{ status: 401 },
			);
		}
		return NextResponse.json(
			{ email: ctx.email, role: ctx.role },
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
