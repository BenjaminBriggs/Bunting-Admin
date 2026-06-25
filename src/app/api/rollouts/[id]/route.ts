import { Prisma } from '@/generated/prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
	updateRolloutSchema,
	zodErrorResponse,
} from '@/lib/validation-schemas';

// GET /api/rollouts/[id]
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const rollout = await prisma.testRollout.findUnique({
			where: {
				id,
				type: 'ROLLOUT',
			},
		});

		if (!rollout) {
			return NextResponse.json({ error: 'Rollout not found' }, { status: 404 });
		}

		return NextResponse.json(rollout);
	} catch (error) {
		logger.error({ err: error }, 'Error fetching rollout');
		return NextResponse.json(
			{ error: 'Failed to fetch rollout' },
			{ status: 500 },
		);
	}
}

// PUT /api/rollouts/[id]
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const actor = await actorFromHeaders(request.headers);
	try {
		const updateData = updateRolloutSchema.parse(
			await request.json(),
		) as Prisma.TestRolloutUncheckedUpdateInput;

		const rollout = await prisma.testRollout.update({
			where: {
				id,
				type: 'ROLLOUT',
			},
			data: updateData,
		});

		await logActivity({
			actor,
			action: 'update',
			entityType: 'rollout',
			entityId: rollout.id,
			appId: rollout.appId,
			summary: `Updated rollout ${rollout.name}`,
		});

		return NextResponse.json(rollout);
	} catch (error) {
		const validationError = zodErrorResponse(error);
		if (validationError) {
			return validationError;
		}
		logger.error({ err: error }, 'Error updating rollout');
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2025'
		) {
			return NextResponse.json({ error: 'Rollout not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to update rollout' },
			{ status: 500 },
		);
	}
}

// DELETE /api/rollouts/[id]
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const actor = await actorFromHeaders(request.headers);
	try {
		const record = await prisma.testRollout.findUnique({
			where: { id, type: 'ROLLOUT' },
		});

		await prisma.testRollout.delete({
			where: {
				id,
				type: 'ROLLOUT',
			},
		});

		await logActivity({
			actor,
			action: 'delete',
			entityType: 'rollout',
			entityId: id,
			appId: record?.appId,
			summary: `Deleted rollout`,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error({ err: error }, 'Error deleting rollout');
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2025'
		) {
			return NextResponse.json({ error: 'Rollout not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to delete rollout' },
			{ status: 500 },
		);
	}
}
