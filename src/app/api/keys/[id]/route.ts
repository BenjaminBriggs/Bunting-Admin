import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-log';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
	activateSigningKey,
	deleteSigningKey,
	retireSigningKey,
	signingKeyErrorResponse,
} from '@/lib/signing-keys';

// STANDBY is never set directly: a key only drops to STANDBY when another key
// is activated, so an app can't be left without a signing key.
const updateKeySchema = z.object({
	status: z.enum(['ACTIVE', 'RETIRED']),
});

interface RouteParams {
	params: Promise<{
		id: string;
	}>;
}

// GET /api/keys/[id] - Get specific signing key details
export async function GET(request: NextRequest, { params }: RouteParams) {
	const { id: keyId } = await params;
	try {
		const { searchParams } = new URL(request.url);
		const appId = searchParams.get('appId');

		if (!appId) {
			return NextResponse.json(
				{ error: 'appId parameter is required' },
				{ status: 400 },
			);
		}

		// Get signing key (exclude private key from response)
		const signingKey = await prisma.signingKey.findUnique({
			where: { appId_kid: { appId, kid: keyId } },
			select: {
				id: true,
				kid: true,
				publicKey: true,
				algorithm: true,
				status: true,
				createdAt: true,
				app: {
					select: {
						id: true,
						name: true,
						identifier: true,
					},
				},
			},
		});

		if (!signingKey) {
			return NextResponse.json(
				{ error: 'Signing key not found' },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			key: signingKey,
		});
	} catch (error) {
		logger.error({ err: error }, 'Failed to get signing key');
		return NextResponse.json(
			{ error: 'Failed to retrieve signing key' },
			{ status: 500 },
		);
	}
}

// PUT /api/keys/[id] - Lifecycle transition: activate (STANDBY -> ACTIVE) or
// retire (STANDBY -> RETIRED)
export async function PUT(request: NextRequest, { params }: RouteParams) {
	const { id: keyId } = await params;
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const { searchParams } = new URL(request.url);
		const appId = searchParams.get('appId');

		if (!appId) {
			return NextResponse.json(
				{ error: 'appId parameter is required' },
				{ status: 400 },
			);
		}

		const body: unknown = await request.json();
		const { status } = updateKeySchema.parse(body);

		if (status === 'ACTIVE') {
			const result = await activateSigningKey(appId, keyId);
			if (result.changed) {
				await logActivity({
					actor: authz.email,
					action: 'activate',
					entityType: 'signing_key',
					entityId: result.keyId,
					appId,
					summary: `Activated signing key ${keyId}`,
					changes: { previousActiveKid: result.previousActiveKid },
				});
			}
			return NextResponse.json({
				message: 'Signing key activated',
				keyId,
				status,
				previousActiveKeyId: result.previousActiveKid,
			});
		}

		const result = await retireSigningKey(appId, keyId);
		if (result.changed) {
			await logActivity({
				actor: authz.email,
				action: 'retire',
				entityType: 'signing_key',
				entityId: result.keyId,
				appId,
				summary: `Retired signing key ${keyId}`,
			});
		}
		return NextResponse.json({
			message: 'Signing key retired',
			keyId,
			status,
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

		logger.error({ err: error }, 'Failed to update signing key');
		return NextResponse.json(
			{ error: 'Failed to update signing key' },
			{ status: 500 },
		);
	}
}

// DELETE /api/keys/[id] - Delete a signing key (must be RETIRED)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
	const { id: keyId } = await params;
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const { searchParams } = new URL(request.url);
		const appId = searchParams.get('appId');

		if (!appId) {
			return NextResponse.json(
				{ error: 'appId parameter is required' },
				{ status: 400 },
			);
		}

		const result = await deleteSigningKey(appId, keyId);

		await logActivity({
			actor: authz.email,
			action: 'delete',
			entityType: 'signing_key',
			entityId: result.keyId,
			appId,
			summary: `Deleted signing key ${keyId}`,
		});

		return NextResponse.json({
			message: 'Signing key deleted successfully',
			keyId,
		});
	} catch (error) {
		const keyError = signingKeyErrorResponse(error);
		if (keyError) {
			return keyError;
		}

		logger.error({ err: error }, 'Failed to delete signing key');
		return NextResponse.json(
			{ error: 'Failed to delete signing key' },
			{ status: 500 },
		);
	}
}
