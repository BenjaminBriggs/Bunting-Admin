import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { logger } from '@/lib/logger';
import {
	completeTestRollout,
	TestRolloutLifecycleError,
} from '@/lib/test-rollout-lifecycle';
import {
	completeTestRolloutSchema,
	zodErrorResponse,
} from '@/lib/validation-schemas';

// POST /api/test-rollouts/[id]/complete
// Bakes the rollout value (or the test's winning group) into the attached flags
// and archives it with outcome COMPLETED. A draft change until the next publish.
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const actor = await actorFromHeaders(request.headers);
	try {
		// Rollouts may send no body at all.
		const body: unknown = await request.json().catch(() => ({}));
		const { winner } = completeTestRolloutSchema.parse(body ?? {});

		const { testRollout, baked } = await completeTestRollout(id, winner);

		const entityType = testRollout.type === 'TEST' ? 'test' : 'rollout';
		const flagCount = new Set(baked.map((b) => b.flagId)).size;
		await logActivity({
			actor,
			action: 'complete',
			entityType,
			entityId: testRollout.id,
			appId: testRollout.appId,
			summary:
				`Completed ${entityType} ${testRollout.key}` +
				(testRollout.winner ? ` with winner ${testRollout.winner}` : '') +
				`; baked into ${flagCount} flag${flagCount === 1 ? '' : 's'}`,
			changes: { winner: testRollout.winner, baked },
		});

		return NextResponse.json(testRollout);
	} catch (error) {
		const validationError = zodErrorResponse(error);
		if (validationError) {
			return validationError;
		}
		if (error instanceof TestRolloutLifecycleError) {
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		}
		logger.error({ err: error }, 'Error completing test/rollout');
		return NextResponse.json(
			{ error: 'Failed to complete test/rollout' },
			{ status: 500 },
		);
	}
}
