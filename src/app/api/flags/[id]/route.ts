import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { prisma } from '@/lib/db';
import {
	canDelete,
	DELETE_BLOCK_MESSAGE,
	deleteBlockReason,
	isPublished,
} from '@/lib/flag-lifecycle';
import { logger } from '@/lib/logger';
import { updateFlagSchema, zodErrorResponse } from '@/lib/validation-schemas';

// GET /api/flags/[id] - Get a specific flag
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const flag = await prisma.flag.findUnique({
			where: { id },
			include: {
				app: {
					select: { name: true, identifier: true },
				},
			},
		});

		if (!flag) {
			return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
		}

		return NextResponse.json(flag);
	} catch (error) {
		logger.error({ err: error }, 'Error fetching flag');
		return NextResponse.json(
			{ error: 'Failed to fetch flag' },
			{ status: 500 },
		);
	}
}

// PUT /api/flags/[id] - Update a flag
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const actor = await actorFromHeaders(request.headers);
		// Parsing whitelists updatable fields and strips id/appId/timestamps,
		// closing the mass-assignment hole from spreading the raw body.
		// The parsed `type` is the lowercase wire enum; it is remapped to the
		// uppercase Prisma enum below, and archive timestamps are derived here,
		// so the mutation shape is wider than the parsed shape.
		const parsed = updateFlagSchema.parse(await request.json());
		// Mutable copy: the parsed `type` is the lowercase wire enum (remapped to
		// the uppercase Prisma enum below) and archive timestamps are derived here,
		// so the mutation shape is wider than the parsed shape. Cast at the
		// prisma boundary once everything is normalized.
		const updateData: Record<string, unknown> = { ...parsed };

		const existing = await prisma.flag.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
		}

		const fieldKeys = Object.keys(updateData).filter((k) => k !== 'archived');

		// Archived flags are frozen: the only permitted change is unarchiving.
		if (existing.archived && fieldKeys.length > 0) {
			return NextResponse.json(
				{
					error:
						'This flag is archived and locked. Unarchive it before editing.',
				},
				{ status: 409 },
			);
		}

		// Archiving is only meaningful once a flag has shipped. A never-published
		// flag should be deleted instead (clean removal, as if it never existed).
		if (updateData.archived === true && !isPublished(existing)) {
			return NextResponse.json(
				{
					error:
						'This flag has never been released, so it can be deleted directly instead of archived.',
				},
				{ status: 409 },
			);
		}

		// Handle archiving
		if (updateData.archived !== undefined && updateData.archived) {
			updateData.archivedAt = new Date();
		} else if (updateData.archived === false) {
			updateData.archivedAt = null;
		}

		// Map string type to enum if provided
		if (typeof updateData.type === 'string') {
			const typeMap: Record<string, Prisma.FlagUpdateInput['type']> = {
				bool: 'BOOL',
				string: 'STRING',
				int: 'INT',
				double: 'DOUBLE',
				date: 'DATE',
				json: 'JSON',
			};
			updateData.type = typeMap[updateData.type] ?? updateData.type;
		}

		const flag = await prisma.flag.update({
			where: { id },
			data: updateData,
			include: {
				app: {
					select: { name: true, identifier: true },
				},
			},
		});

		const action =
			updateData.archived === true
				? 'archive'
				: updateData.archived === false
					? 'unarchive'
					: 'update';
		const summary =
			action === 'archive'
				? `Archived flag ${flag.key}`
				: action === 'unarchive'
					? `Unarchived flag ${flag.key}`
					: `Updated flag ${flag.key}`;
		await logActivity({
			actor,
			action,
			entityType: 'flag',
			entityId: flag.id,
			appId: flag.appId,
			summary,
		});

		return NextResponse.json(flag);
	} catch (error) {
		const validationError = zodErrorResponse(error);
		if (validationError) {
			return validationError;
		}
		logger.error({ err: error }, 'Error updating flag');
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2025'
		) {
			return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to update flag' },
			{ status: 500 },
		);
	}
}

// DELETE /api/flags/[id] - Delete a flag
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const actor = await actorFromHeaders(request.headers);
		const existing = await prisma.flag.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
		}

		// Enforce the lifecycle: never-published flags delete directly; published
		// flags must be archived and released at least once while archived.
		if (!canDelete(existing)) {
			const reason = deleteBlockReason(existing);
			return NextResponse.json(
				{ error: reason ? DELETE_BLOCK_MESSAGE[reason] : 'Cannot delete flag' },
				{ status: 409 },
			);
		}

		await prisma.flag.delete({
			where: { id },
		});

		await logActivity({
			actor,
			action: 'delete',
			entityType: 'flag',
			entityId: existing.id,
			appId: existing.appId,
			summary: `Deleted flag ${existing.key}`,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error({ err: error }, 'Error deleting flag');
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2025'
		) {
			return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to delete flag' },
			{ status: 500 },
		);
	}
}
