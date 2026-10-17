import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
	assignGroupPositions,
	type StoredTestVariants,
} from '@/lib/test-group-variants';
import { REACTIVATE_FINISHED_MESSAGE } from '@/lib/test-rollout-lifecycle';
import {
	updateTestRolloutSchema,
	zodErrorResponse,
} from '@/lib/validation-schemas';

// A nullable JSON column in a partial update: absent leaves it unchanged, an
// explicit null clears it (Prisma needs DbNull for SQL NULL on JSON columns).
function nullableJson(
	value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
	if (value === undefined) {
		return undefined;
	}
	return value ?? Prisma.DbNull;
}

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

		const existing = await prisma.testRollout.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json(
				{ error: 'Test/Rollout not found' },
				{ status: 404 },
			);
		}
		if (existing.outcome && archived === false) {
			return NextResponse.json(
				{ error: REACTIVATE_FINISHED_MESSAGE },
				{ status: 409 },
			);
		}

		// Partial update: a field absent from the body is left unchanged (Prisma
		// skips `undefined`). Only an explicit `null` clears a nullable column;
		// the nullable JSON blobs need Prisma.DbNull for that. Test group
		// positions are server-owned (see assignGroupPositions).
		const testRollout = await prisma.testRollout.update({
			where: {
				id,
			},
			data: {
				name,
				description,
				group,
				percentage,
				conditions,
				flagIds,
				archived,
				variants: nullableJson(
					existing.type === 'TEST'
						? assignGroupPositions(
								existing.variants as unknown as StoredTestVariants | null,
								variants,
							)
						: variants,
				),
				rolloutValues: nullableJson(rolloutValues),
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
