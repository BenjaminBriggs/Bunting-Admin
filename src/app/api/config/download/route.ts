import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getConfigBucket, getS3Client } from '@/lib/storage';

const downloadConfigSchema = z.object({
	appIdentifier: z.string(),
});

const s3Client = getS3Client();

// POST /api/config/download - Download published config file
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { appIdentifier } = downloadConfigSchema.parse(body);

		const bucketName = getConfigBucket();

		// Get config from S3
		const configKey = `${appIdentifier}/config.json`;
		const command = new GetObjectCommand({
			Bucket: bucketName,
			Key: configKey,
		});

		const response = await s3Client.send(command);

		if (!response.Body) {
			return NextResponse.json(
				{ error: 'Config file not found' },
				{ status: 404 },
			);
		}

		const configContent = await response.Body.transformToString();
		const config = JSON.parse(configContent);

		// Generate filename with version
		const filename = `${appIdentifier}-v${config.config_version ?? 'latest'}.json`;

		// Return the config as a downloadable file
		return new NextResponse(JSON.stringify(config, null, 2), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'no-cache',
			},
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}

		console.error('Error downloading config:', error);
		return NextResponse.json(
			{ error: 'Failed to download configuration' },
			{ status: 500 },
		);
	}
}
