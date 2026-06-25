import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { artifactUrlFor } from '@/lib/storage';

const updateAppSchema = z.object({
	name: z.string().optional(),
	identifier: z.string().optional(),
	publicKeys: z
		.array(
			z.object({
				kid: z.string(),
				pem: z.string(),
			}),
		)
		.optional(),
	fetchPolicy: z
		.object({
			min_interval_seconds: z.number(),
			hard_ttl_days: z.number(),
		})
		.optional(),
});

// GET /api/apps/[id] - Get a specific app
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	// Await params in Next.js 15
	const { id } = await params;
	try {
		const app = await prisma.app.findUnique({
			where: { id },
			include: {
				_count: {
					select: {
						flags: true,
					},
				},
			},
		});

		if (!app) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		return NextResponse.json(app);
	} catch (error) {
		logger.error({ err: error }, 'Error fetching app');
		return NextResponse.json({ error: 'Failed to fetch app' }, { status: 500 });
	}
}

// PUT /api/apps/[id] - Update an app
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	// Await params in Next.js 15
	const { id } = await params;
	try {
		const body: unknown = await request.json();
		const validatedData = updateAppSchema.parse(body);

		// Check if app exists
		const existingApp = await prisma.app.findUnique({
			where: { id },
		});

		if (!existingApp) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		// If identifier is being updated, check for conflicts and re-derive the artifact URL.
		const identifierChanged =
			!!validatedData.identifier &&
			validatedData.identifier !== existingApp.identifier;
		if (identifierChanged) {
			const conflictingApp = await prisma.app.findUnique({
				where: { identifier: validatedData.identifier },
			});

			if (conflictingApp) {
				return NextResponse.json(
					{ error: 'An app with this identifier already exists' },
					{ status: 409 },
				);
			}
		}

		const updatedApp = await prisma.app.update({
			where: { id },
			data: {
				...validatedData,
				...(identifierChanged
					? { artifactUrl: artifactUrlFor(validatedData.identifier!) }
					: {}),
			},
			include: {
				_count: {
					select: {
						flags: true,
					},
				},
			},
		});

		const actor = await actorFromHeaders(request.headers);
		await logActivity({
			actor,
			action: 'update',
			entityType: 'app',
			entityId: id,
			appId: id,
			summary: `Updated app ${updatedApp.name}`,
		});

		return NextResponse.json(updatedApp);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}

		logger.error({ err: error }, 'Error updating app');
		return NextResponse.json(
			{ error: 'Failed to update app' },
			{ status: 500 },
		);
	}
}

// DELETE /api/apps/[id] - Delete an app
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	// Await params in Next.js 15
	const { id } = await params;
	try {
		// Check if app exists
		const existingApp = await prisma.app.findUnique({
			where: { id },
		});

		if (!existingApp) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		// Delete the app (cascades to flags due to Prisma schema)
		await prisma.app.delete({
			where: { id },
		});

		const actor = await actorFromHeaders(request.headers);
		await logActivity({
			actor,
			action: 'delete',
			entityType: 'app',
			entityId: id,
			appId: id,
			summary: `Deleted app ${existingApp.name}`,
		});

		return NextResponse.json({ message: 'App deleted successfully' });
	} catch (error) {
		logger.error({ err: error }, 'Error deleting app');
		return NextResponse.json(
			{ error: 'Failed to delete app' },
			{ status: 500 },
		);
	}
}
