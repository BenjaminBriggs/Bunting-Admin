import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-log';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const updateUserSchema = z.object({
	userId: z.string(),
	role: z.enum(['ADMIN', 'DEVELOPER']),
});

export async function GET(_request: NextRequest) {
	try {
		const session = await auth();

		if (session?.user.role !== 'ADMIN') {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const users = await db.user.findMany({
			select: {
				id: true,
				email: true,
				name: true,
				image: true,
				role: true,
				createdAt: true,
				lastActiveAt: true,
			},
			orderBy: { createdAt: 'desc' },
		});

		return NextResponse.json(users);
	} catch (error) {
		logger.error({ err: error }, 'Failed to fetch users');
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const session = await auth();

		if (session?.user.role !== 'ADMIN') {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body: unknown = await request.json();
		const { userId, role } = updateUserSchema.parse(body);

		// Prevent changing your own role to DEVELOPER (would lock yourself out)
		if (userId === session.user.id && role === 'DEVELOPER') {
			return NextResponse.json(
				{ error: 'Cannot change your own role to Developer' },
				{ status: 400 },
			);
		}

		const user = await db.user.update({
			where: { id: userId },
			data: { role },
			select: {
				id: true,
				email: true,
				name: true,
				image: true,
				role: true,
				createdAt: true,
				lastActiveAt: true,
			},
		});

		const actor = session.user.email;
		await logActivity({
			actor,
			action: 'update',
			entityType: 'user',
			entityId: user.id,
			appId: null,
			summary: `Set role of ${user.email} to ${role}`,
		});

		return NextResponse.json(user);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data' },
				{ status: 400 },
			);
		}

		logger.error({ err: error }, 'Failed to update user');
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}
