import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { identityFromRequest } from '@/lib/auth-session';
import { getConfigChanges } from '@/lib/config-comparison';
import { generateConfigFromDb } from '@/lib/config-generator';
import { generateRSAKeyPair } from '@/lib/crypto';
import { prisma } from '@/lib/db';
import { signConfigDetached } from '@/lib/jws-signer';
import { storePrivateKey } from '@/lib/key-protection';
import {
	getConfigBucket,
	getS3Client,
	latestConfigKey,
	versionedConfigKey,
} from '@/lib/storage';
import { computeNextVersion } from '@/lib/versioning';

const publishConfigSchema = z.object({
	appId: z.string(),
	changelog: z.string().min(1, 'Changelog is required'),
});

const s3Client = getS3Client();

// POST /api/config/publish - Publish configuration to S3
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { appId, changelog } = publishConfigSchema.parse(body);

		const bucketName = getConfigBucket();

		// Who is publishing — works in both oidc and proxy auth modes.
		const identity = await identityFromRequest(request.headers);
		const publishedBy = identity?.email ?? 'unknown';

		// Generate current config
		const baseConfig = await generateConfigFromDb(appId);
		const appIdentifier = baseConfig.app_identifier;

		// Previous published config (for the changelog diff).
		const previousConfig = await getPublishedConfigFromS3(appIdentifier).catch(
			() => ({ config: null }),
		);

		// Ensure app has a signing key (create one if none exists)
		await ensureSigningKey(appId);

		// Allocate + RESERVE the version atomically. A per-app advisory lock
		// serializes concurrent publishes so two instances can't mint the same N.
		const today = new Date().toISOString().split('T')[0];
		const reservation = await prisma.$transaction(async (tx) => {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${appId}))`;
			const rows = await tx.auditLog.findMany({
				where: { appId, configVersion: { startsWith: today } },
				select: { configVersion: true },
			});
			const version = computeNextVersion(
				rows.map((r) => r.configVersion),
				today,
			);
			const audit = await tx.auditLog.create({
				data: {
					appId,
					configVersion: version,
					publishedAt: new Date(),
					publishedBy,
					changelog,
					configDiff: {},
				},
			});
			return { version, auditId: audit.id };
		});
		const version = reservation.version;

		// Build + sign exactly the bytes we upload.
		const publishedConfig = {
			...baseConfig,
			config_version: version,
			published_at: new Date().toISOString(),
		};
		const configContent = JSON.stringify(publishedConfig, null, 2);
		const signingResult = await signConfigDetached(appId, configContent);

		const configKey = latestConfigKey(appIdentifier);
		const signatureKey = `${appIdentifier}/config.json.sig`;

		// Upload the signature FIRST, then config.json. The SDK keys on config.json
		// (and derives the .sig URL from it), so once config.json lands its matching
		// signature is already present. Two S3 objects can't be updated truly
		// atomically; this ordering keeps a reader either consistent or safely
		// falling back to its cached config.
		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucketName,
				Key: signatureKey,
				Body: signingResult.signature,
				ContentType: 'text/plain',
				CacheControl: 'max-age=300, stale-while-revalidate=86400',
			}),
		);
		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucketName,
				Key: configKey,
				Body: configContent,
				ContentType: 'application/json',
				CacheControl: 'max-age=300, stale-while-revalidate=86400',
				Metadata: {
					'x-bunting-key-id': signingResult.keyId,
					'x-bunting-algorithm': signingResult.algorithm,
					'x-bunting-version': version,
				},
			}),
		);

		// Also write an immutable per-version archive. `config.json` is overwritten
		// every publish, so this is the only addressable copy of this exact version
		// — used by the fingerprint decoder to resolve a client's flags. Best-effort:
		// a failure here must not fail the publish (the live config is already up).
		try {
			await s3Client.send(
				new PutObjectCommand({
					Bucket: bucketName,
					Key: versionedConfigKey(appIdentifier, version),
					Body: configContent,
					ContentType: 'application/json',
					CacheControl: 'public, max-age=31536000, immutable',
					Metadata: {
						'x-bunting-key-id': signingResult.keyId,
						'x-bunting-algorithm': signingResult.algorithm,
						'x-bunting-version': version,
					},
				}),
			);
		} catch (archiveError) {
			console.error('Failed to write versioned config archive:', archiveError);
		}

		// Finalize the reserved audit row now that the upload succeeded.
		const configChanges = getConfigChanges(baseConfig, previousConfig.config);
		const flagCount = Object.keys(publishedConfig.flags || {}).length;
		const artifactSize = configContent.length;
		await prisma.auditLog.update({
			where: { id: reservation.auditId },
			data: {
				configDiff: {
					changes: configChanges,
					flagCount,
					configSize: artifactSize,
				} as unknown as Prisma.InputJsonValue,
				artifactSize,
			},
		});

		// Stamp lifecycle tracking on every flag that made it into this artifact.
		// firstPublishedAt is set once (drives never-published → delete-direct);
		// lastPublishedAt advances every publish — for archived flags this pushes it
		// past archivedAt, which is what unlocks deletion. Archived flags are in the
		// artifact (marked deprecated), so they're stamped too.
		const publishedKeys = Object.keys(publishedConfig.flags || {});
		if (publishedKeys.length > 0) {
			const now = new Date();
			await prisma.flag.updateMany({
				where: { appId, key: { in: publishedKeys } },
				data: { lastPublishedAt: now },
			});
			await prisma.flag.updateMany({
				where: { appId, key: { in: publishedKeys }, firstPublishedAt: null },
				data: { firstPublishedAt: now },
			});
		}

		return NextResponse.json({
			version,
			publishedAt: publishedConfig.published_at,
			keyId: signingResult.keyId,
			signed: true,
			message: 'Configuration published and signed successfully',
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}

		console.error('Error publishing config:', error);
		return NextResponse.json(
			{
				error: 'Failed to publish configuration',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 },
		);
	}
}

async function getPublishedConfigFromS3(
	appIdentifier: string,
): Promise<{ config: any | null }> {
	const bucketName = getConfigBucket();

	try {
		const configKey = `${appIdentifier}/config.json`;
		const command = new GetObjectCommand({
			Bucket: bucketName,
			Key: configKey,
		});

		const response = await s3Client.send(command);

		if (!response.Body) {
			return { config: null };
		}

		const configContent = await response.Body.transformToString();
		const config = JSON.parse(configContent);

		return { config };
	} catch (error) {
		// Config doesn't exist yet or other error
		return { config: null };
	}
}

// Ensure an app has at least one active signing key
async function ensureSigningKey(appId: string): Promise<void> {
	try {
		// Check if app has any active signing keys
		const existingActiveKey = await prisma.signingKey.findFirst({
			where: { appId, isActive: true },
		});

		if (existingActiveKey) {
			return; // Already has an active key
		}

		// Check if app has any inactive keys we can activate
		const existingInactiveKey = await prisma.signingKey.findFirst({
			where: { appId, isActive: false },
		});

		if (existingInactiveKey) {
			// Activate an existing inactive key
			await prisma.signingKey.update({
				where: { id: existingInactiveKey.id },
				data: { isActive: true },
			});
			console.log(
				`Activated existing signing key ${existingInactiveKey.kid} for app ${appId}`,
			);
			return;
		}

		// No keys exist, generate a new one
		const keyPair = await generateRSAKeyPair();
		await prisma.signingKey.create({
			data: {
				appId,
				kid: keyPair.kid,
				privateKey: await storePrivateKey(keyPair.privateKey),
				publicKey: keyPair.publicKey,
				algorithm: keyPair.algorithm,
				isActive: true,
			},
		});
		console.log(`Generated new signing key ${keyPair.kid} for app ${appId}`);
	} catch (error) {
		console.error('Failed to ensure signing key:', error);
		throw new Error('Failed to ensure signing key exists');
	}
}
