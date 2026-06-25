import { Prisma } from '@/generated/prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// PUT /api/rollouts/[id]/percentage
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const actor = await actorFromHeaders(request.headers);
	try {
		const { percentage } = (await request.json()) as { percentage?: unknown };

		// Validate percentage
		if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
			return NextResponse.json(
				{
					error: 'Percentage must be a number between 0 and 100',
				},
				{ status: 400 },
			);
		}

		const rollout = await prisma.testRollout.update({
			where: {
				id,
				type: 'ROLLOUT',
			},
			data: { percentage },
		});

		await logActivity({
			actor,
			action: 'update',
			entityType: 'rollout',
			entityId: rollout.id,
			appId: rollout.appId,
			summary: `Set rollout ${rollout.name} to ${percentage}%`,
		});

		return NextResponse.json(rollout);
	} catch (error) {
		logger.error({ err: error }, 'Error updating rollout percentage');
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2025'
		) {
			return NextResponse.json({ error: 'Rollout not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to update rollout percentage' },
			{ status: 500 },
		);
	}
}
