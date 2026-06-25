import type { Prisma } from '@/generated/prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
	updateTestRolloutSchema,
	zodErrorResponse,
} from '@/lib/validation-schemas';

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const testRollout = await prisma.testRollout.findUnique({
			where: {
				id,
			},
		});

		if (!testRollout) {
			return NextResponse.json(
				{ error: 'Test/Rollout not found' },
				{ status: 404 },
			);
		}

		return NextResponse.json(testRollout);
	} catch (error) {
		logger.error({ err: error }, 'Failed to fetch test/rollout');
		return NextResponse.json(
			{ error: 'Failed to fetch test/rollout' },
			{ status: 500 },
		);
	}
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const actor = await actorFromHeaders(request.headers);
	try {
		// variants/rolloutValues are z.any() in the schema (opaque JSON blobs), so
		// the parsed object carries them as `any`. Re-type the whole parsed result
		// as unknown-valued blobs so they flow cleanly into the JSON column input.
		const parsed = updateTestRolloutSchema.parse(await request.json()) as Omit<
			ReturnType<typeof updateTestRolloutSchema.parse>,
			'variants' | 'rolloutValues'
		> & { variants?: unknown; rolloutValues?: unknown };
		const {
			name,
			description,
			group,
			percentage,
			conditions,
			flagIds,
			archived,
			variants,
			rolloutValues,
		} = parsed;

		const testRollout = await prisma.testRollout.update({
			where: {
				id,
			},
			data: {
				name,
				description,
				group: group ?? null,
				percentage,
				conditions: conditions ?? [],
				flagIds: flagIds ?? [],
				archived: archived ?? false,
				variants: (variants ?? null) as Prisma.InputJsonValue,
				rolloutValues: (rolloutValues ?? null) as Prisma.InputJsonValue,
				updatedAt: new Date(),
			},
		});

		const entityType = testRollout.type === 'TEST' ? 'test' : 'rollout';
		await logActivity({
			actor,
			action: 'update',
			entityType,
			entityId: testRollout.id,
			appId: testRollout.appId,
			summary: `Updated ${entityType} ${testRollout.name}`,
		});

		return NextResponse.json(testRollout);
	} catch (error) {
		const validationError = zodErrorResponse(error);
		if (validationError) {
			return validationError;
		}
		logger.error({ err: error }, 'Failed to update test/rollout');
		return NextResponse.json(
			{ error: 'Failed to update test/rollout' },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const actor = await actorFromHeaders(request.headers);
	try {
		const record = await prisma.testRollout.findUnique({ where: { id } });

		await prisma.testRollout.delete({
			where: {
				id,
			},
		});

		if (record) {
			const entityType = record.type === 'TEST' ? 'test' : 'rollout';
			await logActivity({
				actor,
				action: 'delete',
				entityType,
				entityId: id,
				appId: record.appId,
				summary: `Deleted ${entityType}`,
			});
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error({ err: error }, 'Failed to delete test/rollout');
		return NextResponse.json(
			{ error: 'Failed to delete test/rollout' },
			{ status: 500 },
		);
	}
}
