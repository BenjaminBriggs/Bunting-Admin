import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Health checks must hit the live process and its database, never a cache.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — liveness + database reachability.
 *
 * Public (whitelisted in middleware) so load balancers and orchestrators can
 * probe it without credentials. Returns 200 when the process is up and the
 * database answers a trivial query; 503 when the database is unreachable.
 */
export async function GET() {
	try {
		await prisma.$queryRaw`SELECT 1`;
		return NextResponse.json({ status: 'ok', db: 'up' }, { status: 200 });
	} catch {
		// Intentionally opaque: do not leak connection details to an unauthenticated
		// probe. The cause is captured server-side via the thrown error elsewhere.
		return NextResponse.json(
			{ status: 'degraded', db: 'down' },
			{ status: 503 },
		);
	}
}
