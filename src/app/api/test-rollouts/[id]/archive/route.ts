import { Prisma } from '@/generated/prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// POST /api/test-rollouts/[id]/archive
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const actor = await actorFromHeaders(request.headers);
	try {
		const { type } = (await request.json()) as { type?: unknown };

		if (type !== 'cancel' && type !== 'complete') {
			return NextResponse.json(
				{
					error: 'Type must be either "cancel" or "complete"',
				},
				{ status: 400 },
			);
		}

		// Get the current test/rollout to determine its type
		const testRollout = await prisma.testRollout.findUnique({
			where: { id },
		});

		if (!testRollout) {
			return NextResponse.json(
				{ error: 'Test/Rollout not found' },
				{ status: 404 },
			);
		}

		const updateData: Prisma.TestRolloutUncheckedUpdateInput = {
			archived: true,
			archivedAt: new Date(),
		};

		// For rollouts, update percentage based on archive type
		if (testRollout.type === 'ROLLOUT') {
			updateData.percentage = type === 'cancel' ? 0 : 100;
		}

		// For tests, we could potentially update variant percentages here
		// but for now we'll just mark as archived

		const updated = await prisma.testRollout.update({
			where: { id },
			data: updateData,
		});

		const entityType = testRollout.type === 'TEST' ? 'test' : 'rollout';
		await logActivity({
			actor,
			action: 'archive',
			entityType,
			entityId: id,
			appId: testRollout.appId,
			summary: `Archived ${entityType} (${type})`,
		});

		return NextResponse.json(updated);
	} catch (error) {
		logger.error({ err: error }, 'Error archiving test/rollout');
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2025'
		) {
			return NextResponse.json(
				{ error: 'Test/Rollout not found' },
				{ status: 404 },
			);
		}
		return NextResponse.json(
			{ error: 'Failed to archive test/rollout' },
			{ status: 500 },
		);
	}
}
