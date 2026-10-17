import { Prisma } from '@/generated/prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
	assignGroupPositions,
	type StoredTestVariants,
} from '@/lib/test-group-variants';
import { REACTIVATE_FINISHED_MESSAGE } from '@/lib/test-rollout-lifecycle';
import { updateTestSchema, zodErrorResponse } from '@/lib/validation-schemas';

// GET /api/tests/[id]
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const test = await prisma.testRollout.findUnique({
			where: {
				id,
				type: 'TEST',
			},
		});

		if (!test) {
			return NextResponse.json({ error: 'Test not found' }, { status: 404 });
		}

		return NextResponse.json(test);
	} catch (error) {
		logger.error({ err: error }, 'Error fetching test');
		return NextResponse.json(
			{ error: 'Failed to fetch test' },
			{ status: 500 },
		);
	}
}

// PUT /api/tests/[id]
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const actor = await actorFromHeaders(request.headers);
	try {
		const updateData = updateTestSchema.parse(
			await request.json(),
		) as Prisma.TestRolloutUncheckedUpdateInput;

		const existing = await prisma.testRollout.findUnique({
			where: { id, type: 'TEST' },
			select: { outcome: true, variants: true },
		});
		if (existing?.outcome && updateData.archived === false) {
			return NextResponse.json(
				{ error: REACTIVATE_FINISHED_MESSAGE },
				{ status: 409 },
			);
		}
		// Group positions are server-owned, so omitting them cannot reorder
		// groups (see assignGroupPositions).
		if (existing) {
			updateData.variants = assignGroupPositions(
				existing.variants as unknown as StoredTestVariants | null,
				updateData.variants,
			);
		}

		const test = await prisma.testRollout.update({
			where: {
				id,
				type: 'TEST',
			},
			data: updateData,
		});

		await logActivity({
			actor,
			action: 'update',
			entityType: 'test',
			entityId: test.id,
			appId: test.appId,
			summary: `Updated test ${test.name}`,
		});

		return NextResponse.json(test);
	} catch (error) {
		const validationError = zodErrorResponse(error);
		if (validationError) {
			return validationError;
		}
		logger.error({ err: error }, 'Error updating test');
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2025'
		) {
			return NextResponse.json({ error: 'Test not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to update test' },
			{ status: 500 },
		);
	}
}

// DELETE /api/tests/[id]
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const actor = await actorFromHeaders(request.headers);
	try {
		const record = await prisma.testRollout.findUnique({
			where: { id, type: 'TEST' },
		});

		await prisma.testRollout.delete({
			where: {
				id,
				type: 'TEST',
			},
		});

		await logActivity({
			actor,
			action: 'delete',
			entityType: 'test',
			entityId: id,
			appId: record?.appId,
			summary: `Deleted test`,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error({ err: error }, 'Error deleting test');
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2025'
		) {
			return NextResponse.json({ error: 'Test not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to delete test' },
			{ status: 500 },
		);
	}
}
