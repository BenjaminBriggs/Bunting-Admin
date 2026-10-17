import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-log';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
	activateSigningKey,
	createStandbySigningKey,
	listSigningKeys,
	signingKeyErrorResponse,
} from '@/lib/signing-keys';

const createKeySchema = z.object({
	appId: z.string(),
});

const rotateKeySchema = z.object({
	appId: z.string(),
	newKeyId: z.string(),
});

// GET /api/keys - List signing keys for an app
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const appId = searchParams.get('appId');

		if (!appId) {
			return NextResponse.json(
				{ error: 'appId parameter is required' },
				{ status: 400 },
			);
		}

		// Verify app exists
		const app = await prisma.app.findUnique({
			where: { id: appId },
			select: { id: true, name: true },
		});

		if (!app) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		// Private keys are never selected.
		const keys = await listSigningKeys(appId);

		return NextResponse.json({ app: app.name, keys });
	} catch (error) {
		logger.error({ err: error }, 'Failed to list signing keys');
		return NextResponse.json(
			{ error: 'Failed to retrieve signing keys' },
			{ status: 500 },
		);
	}
}

// POST /api/keys - Create a new STANDBY signing key
export async function POST(request: NextRequest) {
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const body: unknown = await request.json();
		const { appId } = createKeySchema.parse(body);

		// Verify app exists
		const app = await prisma.app.findUnique({
			where: { id: appId },
			select: { id: true },
		});

		if (!app) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		// New keys always start as STANDBY: trusted by bootstrap files downloaded
		// from now on, but not signing until an admin activates them.
		const createdKey = await createStandbySigningKey(appId);

		await logActivity({
			actor: authz.email,
			action: 'create',
			entityType: 'signing_key',
			entityId: createdKey.id,
			appId,
			summary: `Created standby signing key ${createdKey.kid}`,
		});

		// Return public information only
		return NextResponse.json(
			{
				kid: createdKey.kid,
				publicKey: createdKey.publicKey,
				algorithm: createdKey.algorithm,
				status: createdKey.status,
				createdAt: createdKey.createdAt,
				message: 'Signing key created successfully',
			},
			{ status: 201 },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}

		logger.error({ err: error }, 'Failed to create signing key');
		return NextResponse.json(
			{ error: 'Failed to create signing key' },
			{ status: 500 },
		);
	}
}

// PUT /api/keys - Rotate: activate a STANDBY key (the previous ACTIVE key
// becomes STANDBY). Same transition as PUT /api/keys/[id] { status: 'ACTIVE' }.
export async function PUT(request: NextRequest) {
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const body: unknown = await request.json();
		const { appId, newKeyId } = rotateKeySchema.parse(body);

		// Verify app exists
		const app = await prisma.app.findUnique({
			where: { id: appId },
			select: { id: true },
		});

		if (!app) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		const result = await activateSigningKey(appId, newKeyId);

		if (result.changed) {
			await logActivity({
				actor: authz.email,
				action: 'activate',
				entityType: 'signing_key',
				entityId: result.keyId,
				appId,
				summary: `Activated signing key ${newKeyId}`,
				changes: { previousActiveKid: result.previousActiveKid },
			});
		}

		return NextResponse.json({
			message: 'Key rotation completed successfully',
			activeKeyId: newKeyId,
			previousActiveKeyId: result.previousActiveKid,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}
		const keyError = signingKeyErrorResponse(error);
		if (keyError) {
			return keyError;
		}

		logger.error({ err: error }, 'Failed to rotate signing keys');
		return NextResponse.json(
			{ error: 'Failed to rotate signing keys' },
			{ status: 500 },
		);
	}
}
