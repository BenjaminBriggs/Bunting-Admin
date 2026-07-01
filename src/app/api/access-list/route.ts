import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-log';
import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const createAccessEntrySchema = z.object({
	type: z.enum(['EMAIL', 'DOMAIN']),
	value: z.string().min(1),
	role: z.enum(['ADMIN', 'DEVELOPER']),
});

export async function GET(request: NextRequest) {
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const accessList = await db.accessList.findMany({
			include: {
				createdBy: {
					select: {
						id: true,
						email: true,
						name: true,
					},
				},
			},
			orderBy: { createdAt: 'desc' },
		});

		return NextResponse.json(accessList);
	} catch (error) {
		logger.error({ err: error }, 'Failed to fetch access list');
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const body: unknown = await request.json();
		const { type, value, role } = createAccessEntrySchema.parse(body);

		// Validate input based on type
		if (type === 'EMAIL') {
			if (!value.includes('@')) {
				return NextResponse.json(
					{ error: 'Invalid email format' },
					{ status: 400 },
				);
			}
		} else {
			if (!value.startsWith('@')) {
				return NextResponse.json(
					{ error: 'Domain must start with @' },
					{ status: 400 },
				);
			}
		}

		// Check for duplicates
		const existing = await db.accessList.findFirst({
			where: {
				type,
				value: value.toLowerCase(),
			},
		});

		if (existing) {
			return NextResponse.json(
				{ error: 'Entry already exists' },
				{ status: 400 },
			);
		}

		// `createdById` links to a `User` row, which only exists once the actor
		// has signed in via NextAuth (oidc). In proxy mode the admin may only
		// ever exist in the access list, so this is best-effort and nullable.
		const creator = await db.user.findUnique({
			where: { email: authz.email },
			select: { id: true },
		});

		const accessEntry = await db.accessList.create({
			data: {
				type,
				value: value.toLowerCase(),
				role,
				createdById: creator?.id,
			},
			include: {
				createdBy: {
					select: {
						id: true,
						email: true,
						name: true,
					},
				},
			},
		});

		const actor = authz.email;
		await logActivity({
			actor,
			action: 'create',
			entityType: 'access_list',
			entityId: accessEntry.id,
			appId: null,
			summary: `Added ${accessEntry.value} as ${role}`,
		});

		return NextResponse.json(accessEntry);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data' },
				{ status: 400 },
			);
		}

		logger.error({ err: error }, 'Failed to create access entry');
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json(
				{ error: 'ID parameter required' },
				{ status: 400 },
			);
		}

		const deleted = await db.accessList.delete({
			where: { id },
		});

		const actor = authz.email;
		await logActivity({
			actor,
			action: 'delete',
			entityType: 'access_list',
			entityId: id,
			appId: null,
			summary: `Removed ${deleted.value}`,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error({ err: error }, 'Failed to delete access entry');
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}
