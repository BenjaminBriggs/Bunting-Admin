import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { logActivity } from '@/lib/activity-log';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { lockAppSigningKeys } from '@/lib/signing-keys';
import { normalizeArtifactUrl } from '@/lib/storage';

// `identifier` is accepted only so a change can be rejected explicitly: it is
// the S3 path prefix shipped binaries fetch from, so it is immutable.
const updateAppSchema = z.object({
	name: z.string().optional(),
	identifier: z.string().optional(),
	fetchPolicy: z
		.object({
			min_interval_seconds: z.number(),
			hard_ttl_days: z.number(),
		})
		.optional(),
});

const deleteAppSchema = z.object({
	// Typed confirmation: must equal the app's identifier.
	confirmIdentifier: z.string(),
	// Required when the app still has signing keys. Deleting them is
	// irreversible: export any key a shipped binary trusts first.
	deleteSigningKeys: z.boolean().optional().default(false),
});

class AppDeleteConflict extends Error {
	constructor(readonly signingKeyCount: number) {
		super('App still has signing keys');
	}
}

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

		// Normalize a legacy directory-shaped artifactUrl (trailing slash) for
		// rows created before the config.json URL fix.
		return NextResponse.json({
			...app,
			artifactUrl: normalizeArtifactUrl(app.artifactUrl),
		});
	} catch (error) {
		logger.error({ err: error }, 'Error fetching app');
		return NextResponse.json({ error: 'Failed to fetch app' }, { status: 500 });
	}
}

// PUT /api/apps/[id] - Update an app (admin only)
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	// Await params in Next.js 15
	const { id } = await params;
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const body: unknown = await request.json();
		const { name, identifier, fetchPolicy } = updateAppSchema.parse(body);

		// Check if app exists
		const existingApp = await prisma.app.findUnique({
			where: { id },
		});

		if (!existingApp) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		if (identifier !== undefined && identifier !== existingApp.identifier) {
			return NextResponse.json(
				{
					error:
						'The app identifier cannot be changed after creation. Shipped apps fetch their config from a path derived from it.',
				},
				{ status: 409 },
			);
		}

		const updatedApp = await prisma.app.update({
			where: { id },
			data: { name, fetchPolicy },
			include: {
				_count: {
					select: {
						flags: true,
					},
				},
			},
		});

		await logActivity({
			actor: authz.email,
			action: 'update',
			entityType: 'app',
			entityId: id,
			appId: id,
			summary: `Updated app ${updatedApp.name}`,
		});

		return NextResponse.json({
			...updatedApp,
			artifactUrl: normalizeArtifactUrl(updatedApp.artifactUrl),
		});
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

// DELETE /api/apps/[id] - Delete an app (admin only, typed confirmation)
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	// Await params in Next.js 15
	const { id } = await params;
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const body: unknown = await request.json().catch(() => ({}));
		const { confirmIdentifier, deleteSigningKeys } =
			deleteAppSchema.parse(body);

		// Check if app exists
		const existingApp = await prisma.app.findUnique({
			where: { id },
		});

		if (!existingApp) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		if (confirmIdentifier !== existingApp.identifier) {
			return NextResponse.json(
				{
					error:
						'Confirmation does not match. Type the app identifier exactly to delete it.',
				},
				{ status: 400 },
			);
		}

		// Signing keys don't cascade (onDelete: Restrict). They are only deleted
		// here, under the key lock, when the admin explicitly asked for it.
		const deletedKeys = await prisma.$transaction(async (tx) => {
			await lockAppSigningKeys(tx, id);
			const keys = await tx.signingKey.findMany({
				where: { appId: id },
				select: { id: true, kid: true, status: true },
			});
			if (keys.length > 0 && !deleteSigningKeys) {
				throw new AppDeleteConflict(keys.length);
			}
			await tx.signingKey.deleteMany({ where: { appId: id } });
			// Cascades to flags, test-rollouts, rules, audit logs and publications.
			await tx.app.delete({ where: { id } });
			return keys;
		});

		for (const key of deletedKeys) {
			await logActivity({
				actor: authz.email,
				action: 'delete',
				entityType: 'signing_key',
				entityId: key.id,
				appId: id,
				summary: `Deleted ${key.status.toLowerCase()} signing key ${key.kid} with app ${existingApp.name}`,
			});
		}
		await logActivity({
			actor: authz.email,
			action: 'delete',
			entityType: 'app',
			entityId: id,
			appId: id,
			summary: `Deleted app ${existingApp.name}`,
		});

		return NextResponse.json({
			message: 'App deleted successfully',
			deletedSigningKeys: deletedKeys.map((key) => key.kid),
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}
		if (error instanceof AppDeleteConflict) {
			return NextResponse.json(
				{
					error: `This app still has ${error.signingKeyCount} signing key${error.signingKeyCount === 1 ? '' : 's'}. Shipped apps trust them, and deleting them cannot be undone. Export any key you may need, then confirm deleting the keys with the app.`,
					signingKeyCount: error.signingKeyCount,
				},
				{ status: 409 },
			);
		}
		// A key was created after our check (FK restrict on the app row).
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2003'
		) {
			return NextResponse.json(
				{ error: "The app's signing keys changed during deletion. Try again." },
				{ status: 409 },
			);
		}

		logger.error({ err: error }, 'Error deleting app');
		return NextResponse.json(
			{ error: 'Failed to delete app' },
			{ status: 500 },
		);
	}
}
