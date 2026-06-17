import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { identityFromRequest } from './lib/auth-session';

// Authentication gate only. Authorization (roles / access list) is enforced in
// node-runtime route helpers, because Prisma cannot run in edge middleware.
export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Public routes — reachable without authentication.
	if (
		pathname.startsWith('/auth') ||
		pathname === '/' ||
		pathname.startsWith('/api/auth') || // NextAuth.js endpoints
		pathname.startsWith('/api/health') || // health check for the load balancer
		pathname.startsWith('/_next') ||
		pathname.startsWith('/favicon')
	) {
		return NextResponse.next();
	}

	const identity = await identityFromRequest(request.headers);

	if (!identity) {
		if (pathname.startsWith('/api')) {
			return NextResponse.json(
				{ error: 'Authentication required' },
				{ status: 401 },
			);
		}
		const signInUrl = new URL('/auth/signin', request.url);
		signInUrl.searchParams.set('callbackUrl', pathname);
		return NextResponse.redirect(signInUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except static assets, image optimisation, and
		 * public image files (served from /public/images).
		 */
		'/((?!_next/static|_next/image|favicon.ico|images/).*)',
	],
};
