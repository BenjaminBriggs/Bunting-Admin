import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-log';
import { requireAdmin } from '@/lib/authz';
import { logger } from '@/lib/logger';
import {
	exportPassphraseSchema,
	exportSigningKey,
	signingKeyErrorResponse,
} from '@/lib/signing-keys';

const exportKeySchema = z.object({
	keyId: z.string(), // the key's kid
	passphrase: exportPassphraseSchema,
});

// POST /api/keys/export - Download a signing key's private half, encrypted under
// an operator passphrase (PKCS#8, aes-256-cbc). This is the only way to back up
// a key outside the database, or move it to another instance.
export async function POST(request: NextRequest) {
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const body: unknown = await request.json();
		const { keyId, passphrase } = exportKeySchema.parse(body);

		const result = await exportSigningKey(keyId, passphrase);

		await logActivity({
			actor: authz.email,
			action: 'export',
			entityType: 'signing_key',
			entityId: result.keyId,
			appId: result.appId,
			summary: `Exported signing key ${keyId}`,
		});

		const safeIdentifier = result.envelope.appIdentifier.replace(
			/[^A-Za-z0-9._-]/g,
			'_',
		);
		return NextResponse.json(result.envelope, {
			headers: {
				'Content-Disposition': `attachment; filename="bunting-key-${safeIdentifier}-${keyId}.json"`,
				'Cache-Control': 'no-store',
			},
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

		logger.error({ err: error }, 'Failed to export signing key');
		return NextResponse.json(
			{ error: 'Failed to export signing key' },
			{ status: 500 },
		);
	}
}
