import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/activity — read the entity change trail (ADMIN only).
 *
 * Query params:
 *   - appId       optional; scope to one app
 *   - entityType  optional; flag | test | rollout | app | signing_key | user | access_list
 *   - entityId    optional; a specific entity's history (pair with entityType)
 *   - limit       optional; default 100, max 500
 */
export async function GET(request: NextRequest) {
	const authz = await requireAdmin(request.headers);
	if (authz instanceof NextResponse) {
		return authz;
	}

	try {
		const { searchParams } = new URL(request.url);
		const appId = searchParams.get('appId');
		const entityType = searchParams.get('entityType');
		const entityId = searchParams.get('entityId');
		const limit = Math.min(
			Math.max(Number(searchParams.get('limit')) || 100, 1),
			500,
		);

		const entries = await prisma.activityLog.findMany({
			where: {
				...(appId ? { appId } : {}),
				...(entityType ? { entityType } : {}),
				...(entityId ? { entityId } : {}),
			},
			orderBy: { createdAt: 'desc' },
			take: limit,
		});

		return NextResponse.json(entries);
	} catch (err) {
		logger.error(
			{ err, route: '/api/activity' },
			'failed to read activity log',
		);
		return NextResponse.json(
			{ error: 'Failed to read activity log' },
			{ status: 500 },
		);
	}
}
