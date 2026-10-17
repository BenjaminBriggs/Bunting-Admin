import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getBootstrapPublicKeys } from '@/lib/jws-signer';
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
				fetchPolicy: true,
			},
		});
		if (!app) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		// Every trusted key (ACTIVE first, then STANDBY); see the plist route.
		const publicKeys = await getBootstrapPublicKeys(app.id);

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
