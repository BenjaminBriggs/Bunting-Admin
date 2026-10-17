import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-log';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/db';
import {
	exportPassphraseSchema,
	signingKeyExportSchema,
} from '@/lib/key-export';
import { logger } from '@/lib/logger';
import { importSigningKey, signingKeyErrorResponse } from '@/lib/signing-keys';

const importKeySchema = z.object({
	appId: z.string(), // target app
	passphrase: exportPassphraseSchema,
	envelope: signingKeyExportSchema,
});

// POST /api/keys/import - Restore an exported signing key into an app as
// STANDBY, keeping its kid so binaries that already trust it keep verifying.
export async function POST(request: NextRequest) {
	try {
		const authz = await requireAdmin(request.headers);
		if (authz instanceof NextResponse) {
			return authz;
		}

		const body: unknown = await request.json();
		const { appId, passphrase, envelope } = importKeySchema.parse(body);

		const app = await prisma.app.findUnique({
			where: { id: appId },
			select: { id: true },
		});
		if (!app) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		const importedKey = await importSigningKey(appId, envelope, passphrase);

		await logActivity({
			actor: authz.email,
			action: 'import',
			entityType: 'signing_key',
			entityId: importedKey.id,
			appId,
			summary: `Imported signing key ${importedKey.kid} as standby`,
			changes: {
				sourceAppIdentifier: envelope.appIdentifier,
				sourceStatus: envelope.status,
				sourceCreatedAt: envelope.createdAt,
			},
		});

		return NextResponse.json(
			{
				kid: importedKey.kid,
				publicKey: importedKey.publicKey,
				algorithm: importedKey.algorithm,
				status: importedKey.status,
				createdAt: importedKey.createdAt,
				message: 'Signing key imported as standby',
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
		const keyError = signingKeyErrorResponse(error);
		if (keyError) {
			return keyError;
		}

		logger.error({ err: error }, 'Failed to import signing key');
		return NextResponse.json(
			{ error: 'Failed to import signing key' },
			{ status: 500 },
		);
	}
}
