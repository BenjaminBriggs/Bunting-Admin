import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { identityFromRequest } from '@/lib/auth-session';
import { prisma } from '@/lib/db';
import {
	decodeFingerprint,
	FingerprintError,
	splitFingerprint,
} from '@/lib/fingerprint';
import {
	getConfigBucket,
	getS3Client,
	latestConfigKey,
	versionedConfigKey,
} from '@/lib/storage';
import type { ConfigArtifact } from '@/types/core';

const decodeSchema = z.object({
	appId: z.string(),
	code: z.string().min(1),
});

const s3Client = getS3Client();

function isNotFound(error: any): boolean {
	return error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404;
}

async function fetchArtifact(
	appIdentifier: string,
	version: string,
): Promise<ConfigArtifact | null> {
	const bucketName = getConfigBucket();

	const read = async (key: string): Promise<ConfigArtifact | null> => {
		try {
			const response = await s3Client.send(
				new GetObjectCommand({ Bucket: bucketName, Key: key }),
			);
			if (!response.Body) {
				return null;
			}
			return JSON.parse(await response.Body.transformToString('utf-8'));
		} catch (error) {
			if (isNotFound(error)) {
				return null;
			}
			throw error;
		}
	};

	// Prefer the immutable per-version archive.
	const archived = await read(versionedConfigKey(appIdentifier, version));
	if (archived) {
		return archived;
	}

	// Fall back to the live config (covers the current version, which predates or
	// equals the archive). Only valid if its version actually matches the code.
	const latest = await read(latestConfigKey(appIdentifier));
	if (latest?.config_version === version) {
		return latest;
	}

	return null;
}

// POST /api/config/decode — decode a client fingerprint against its version's artifact.
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { appId, code } = decodeSchema.parse(body);

		const identity = await identityFromRequest(request.headers);
		if (!identity) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const app = await prisma.app.findUnique({
			where: { id: appId },
			select: { identifier: true },
		});
		if (!app) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		// Validate shape before any S3 work so typos fail fast.
		const { version } = splitFingerprint(code);

		const artifact = await fetchArtifact(app.identifier, version);
		if (!artifact) {
			return NextResponse.json(
				{
					error: `No retained artifact for version "${version}". Only versions published after per-version archiving was enabled can be decoded.`,
				},
				{ status: 404 },
			);
		}

		const decoded = decodeFingerprint(artifact, code);

		return NextResponse.json({
			version,
			env: decoded.env,
			publishedAt: artifact.published_at,
			appIdentifier: artifact.app_identifier,
			flags: decoded.flags,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}
		if (error instanceof FingerprintError) {
			return NextResponse.json({ error: error.message }, { status: 422 });
		}
		console.error('Error decoding fingerprint:', error);
		return NextResponse.json(
			{ error: 'Failed to decode fingerprint' },
			{ status: 500 },
		);
	}
}
