import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
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
		console.error('Error fetching app:', error);
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

		return NextResponse.json(updatedApp);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}

		console.error('Error updating app:', error);
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

		return NextResponse.json({ message: 'App deleted successfully' });
	} catch (error) {
		console.error('Error deleting app:', error);
		return NextResponse.json(
			{ error: 'Failed to delete app' },
			{ status: 500 },
		);
	}
}
