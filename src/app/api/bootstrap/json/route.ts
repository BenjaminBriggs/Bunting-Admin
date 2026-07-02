import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { normalizeArtifactUrl } from '@/lib/storage';
import { buildBootstrapDocument } from '@/lib/bootstrap';

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const appId = searchParams.get('appId');
		const appIdentifier = searchParams.get('appIdentifier');
		if (!appId && !appIdentifier) {
			return NextResponse.json(
				{ error: 'Either appId or appIdentifier parameter is required' },
				{ status: 400 },
			);
		}

		const app = await prisma.app.findUnique({
			where: appId ? { id: appId } : { identifier: appIdentifier as string },
			select: {
				id: true,
				identifier: true,
				artifactUrl: true,
				publicKeys: true,
				fetchPolicy: true,
			},
		});
		if (!app) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		const signingKeys = await prisma.signingKey.findMany({
			where: { appId: app.id, isActive: true },
			select: { kid: true, publicKey: true },
			orderBy: { createdAt: 'desc' },
		});

		let publicKeys: Array<{ kid: string; pem: string }>;
		if (signingKeys.length > 0) {
			publicKeys = signingKeys.map((k) => ({ kid: k.kid, pem: k.publicKey }));
		} else {
			const appKeys = app.publicKeys as Array<{
				kid: string;
				pem: string;
			}> | null;
			if (!appKeys || appKeys.length === 0) {
				return NextResponse.json(
					{ error: 'No signing keys found for this app' },
					{ status: 404 },
				);
			}
			publicKeys = appKeys;
		}

		const doc = buildBootstrapDocument({
			appIdentifier: app.identifier,
			endpointUrl: normalizeArtifactUrl(app.artifactUrl),
			publicKeys,
			fetchPolicy: app.fetchPolicy as {
				min_interval_seconds?: number;
				hard_ttl_days?: number;
			} | null,
		});

		return NextResponse.json(doc, {
			status: 200,
			headers: {
				'Content-Disposition': 'attachment; filename="bunting_config.json"',
				'Cache-Control': 'private, no-cache',
				'Access-Control-Allow-Origin': '*',
			},
		});
	} catch (error) {
		logger.error({ err: error }, 'Failed to generate bootstrap json');
		return NextResponse.json(
			{ error: 'Failed to generate bootstrap document' },
			{ status: 500 },
		);
	}
}

export function OPTIONS(_request: NextRequest) {
	return new NextResponse(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}
