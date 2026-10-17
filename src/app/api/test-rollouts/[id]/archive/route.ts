import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { logger } from '@/lib/logger';
import {
	abandonTestRollout,
	TestRolloutLifecycleError,
} from '@/lib/test-rollout-lifecycle';

// POST /api/test-rollouts/[id]/archive
// Abandons a test or rollout: archives it with outcome ABANDONED and bakes
// nothing, so its users return to what each flag serves without it. Completing
// (keeping the shipped value) is POST /api/test-rollouts/[id]/complete.
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const actor = await actorFromHeaders(request.headers);
	try {
		// The body is optional. `type: "cancel"` is still accepted from older
		// clients; `type: "complete"` used to archive here too, which silently
		// reverted users to the flag default, so it is now rejected.
		const { type } = (await request.json().catch(() => ({}))) as {
			type?: unknown;
		};
		if (type === 'complete') {
			return NextResponse.json(
				{
					error:
						'Archiving no longer completes. Use POST /api/test-rollouts/[id]/complete to keep the shipped value.',
				},
				{ status: 400 },
			);
		}
		if (type !== undefined && type !== 'cancel' && type !== 'abandon') {
			return NextResponse.json(
				{ error: 'Type must be "abandon" (or the older "cancel") if given' },
				{ status: 400 },
			);
		}

		const updated = await abandonTestRollout(id);

		const entityType = updated.type === 'TEST' ? 'test' : 'rollout';
		await logActivity({
			actor,
			action: 'abandon',
			entityType,
			entityId: id,
			appId: updated.appId,
			summary: `Abandoned ${entityType} ${updated.key}`,
		});

		return NextResponse.json(updated);
	} catch (error) {
		if (error instanceof TestRolloutLifecycleError) {
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		}
		logger.error({ err: error }, 'Error abandoning test/rollout');
		return NextResponse.json(
			{ error: 'Failed to abandon test/rollout' },
			{ status: 500 },
		);
	}
}
