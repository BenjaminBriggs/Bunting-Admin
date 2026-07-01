import { PutObjectCommand } from '@aws-sdk/client-s3';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actorFromHeaders, logActivity } from '@/lib/activity-log';
import { generateConfigFromDb } from '@/lib/config-generator';
import { prisma } from '@/lib/db';
import { ensureSigningKey, signConfigDetached } from '@/lib/jws-signer';
import { logger } from '@/lib/logger';
import {
	artifactUrlFor,
	getConfigBucket,
	getS3Client,
	normalizeArtifactUrl,
} from '@/lib/storage';

const createAppSchema = z.object({
	name: z.string(),
	identifier: z.string(),
	publicKeys: z.array(
		z.object({
			kid: z.string(),
			pem: z.string(),
		}),
	),
	fetchPolicy: z.object({
		min_interval_seconds: z.number(),
		hard_ttl_days: z.number(),
	}),
});

const s3Client = getS3Client();

async function publishInitialConfig(appId: string): Promise<void> {
	const bucketName = getConfigBucket();

	// Generate initial config
	const baseConfig = await generateConfigFromDb(appId);
	const appIdentifier = baseConfig.app_identifier;

	// Create initial config with version 1.0
	const publishedConfig = {
		...baseConfig,
		config_version: new Date().toISOString().split('T')[0] + '.1',
		published_at: new Date().toISOString(),
	};

	const configContent = JSON.stringify(publishedConfig, null, 2);
	const configKey = `${appIdentifier}/config.json`;
	const signatureKey = `${appIdentifier}/config.json.sig`;

	try {
		// A new app has no signing key yet — mint one, then sign the exact bytes
		// we upload so the artifact verifies in the SDK from the very first fetch.
		await ensureSigningKey(appId);
		const signingResult = await signConfigDetached(appId, configContent);

		// Signature first, then config.json (see publish route for the ordering
		// rationale).
		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucketName,
				Key: signatureKey,
				Body: signingResult.signature,
				ContentType: 'text/plain',
				CacheControl: 'max-age=300',
			}),
		);
		await s3Client.send(
			new PutObjectCommand({
				Bucket: bucketName,
				Key: configKey,
				Body: configContent,
				ContentType: 'application/json',
				CacheControl: 'max-age=300', // 5 minutes
				Metadata: {
					'x-bunting-key-id': signingResult.keyId,
					'x-bunting-algorithm': signingResult.algorithm,
					'x-bunting-version': publishedConfig.config_version,
				},
			}),
		);

		// Create audit log entry
		await prisma.auditLog.create({
			data: {
				appId,
				configVersion: publishedConfig.config_version,
				publishedAt: new Date(),
				publishedBy: 'system',
				changelog: 'Initial application configuration',
				configDiff: {},
				artifactSize: configContent.length,
			},
		});
	} catch (error) {
		logger.error({ err: error }, 'Error publishing initial config');
		throw error;
	}
}

// GET /api/apps - List all apps
export async function GET() {
	try {
		const apps = await prisma.app.findMany({
			orderBy: { name: 'asc' },
			include: {
				_count: {
					select: {
						flags: true,
						testRollouts: true,
					},
				},
			},
		});

		// Normalize legacy directory-shaped artifactUrl values (stored with a
		// trailing slash by an older version of artifactUrlFor) for any rows
		// created before the config.json URL fix.
		return NextResponse.json(
			apps.map((app) => ({
				...app,
				artifactUrl: normalizeArtifactUrl(app.artifactUrl),
			})),
		);
	} catch (error) {
		logger.error({ err: error }, 'Error fetching apps');
		return NextResponse.json(
			{ error: 'Failed to fetch apps' },
			{ status: 500 },
		);
	}
}

// POST /api/apps - Create a new app
export async function POST(request: NextRequest) {
	try {
		const body: unknown = await request.json();
		const validatedData = createAppSchema.parse(body);

		// Check if app identifier already exists
		const existingApp = await prisma.app.findUnique({
			where: { identifier: validatedData.identifier },
		});

		if (existingApp) {
			return NextResponse.json(
				{ error: 'An app with this identifier already exists' },
				{ status: 409 },
			);
		}

		const app = await prisma.app.create({
			data: {
				...validatedData,
				// Storage is a single global bucket; the public read URL is derived
				// from CDN_BASE_URL, and per-app storage settings are no longer used.
				artifactUrl: artifactUrlFor(validatedData.identifier),
				storageConfig: {},
			},
			include: {
				_count: {
					select: {
						flags: true,
						testRollouts: true,
					},
				},
			},
		});

		// Publish initial empty config to validate storage settings
		try {
			await publishInitialConfig(app.id);
		} catch (error) {
			// If initial config publish fails, roll back the app row. Guard the
			// delete itself: if it throws we'd otherwise mask the original error and
			// leave a half-created app, so log and continue to the error response.
			try {
				await prisma.app.delete({ where: { id: app.id } });
			} catch (rollbackError) {
				logger.error(
					{ err: rollbackError },
					'Failed to roll back app after initial config failure',
				);
			}
			logger.error({ err: error }, 'Failed to publish initial config');
			return NextResponse.json(
				{
					error:
						'Failed to create initial configuration. Please check your storage settings.',
				},
				{ status: 500 },
			);
		}

		const actor = await actorFromHeaders(request.headers);
		await logActivity({
			actor,
			action: 'create',
			entityType: 'app',
			entityId: app.id,
			appId: app.id,
			summary: `Created app ${app.name}`,
		});

		return NextResponse.json(app, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}

		logger.error({ err: error }, 'Error creating app');
		return NextResponse.json(
			{ error: 'Failed to create app' },
			{ status: 500 },
		);
	}
}
