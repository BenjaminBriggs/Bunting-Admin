import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getConfigBucket, getS3Client } from '@/lib/storage';

const getPublishedConfigSchema = z.object({
	appIdentifier: z.string(),
});

const s3Client = getS3Client();

// POST /api/config/published - Get currently published config from S3
export async function POST(request: NextRequest) {
	try {
		const body: unknown = await request.json();
		const { appIdentifier } = getPublishedConfigSchema.parse(body);

		const bucketName = getConfigBucket();

		// Construct the S3 key for the config file
		const configKey = `${appIdentifier}/config.json`;

		try {
			const command = new GetObjectCommand({
				Bucket: bucketName,
				Key: configKey,
			});

			const response = await s3Client.send(command);

			if (!response.Body) {
				return NextResponse.json(
					{ error: 'Config file is empty' },
					{ status: 404 },
				);
			}

			const configContent = await response.Body.transformToString('utf-8');
			const publishedConfig: unknown = JSON.parse(configContent);

			return NextResponse.json({
				config: publishedConfig,
				lastModified: response.LastModified,
				etag: response.ETag,
			});
		} catch (s3Error) {
			const err = s3Error as {
				name?: string;
				$metadata?: { httpStatusCode?: number };
			};
			if (
				err.name === 'NoSuchKey' ||
				err.$metadata?.httpStatusCode === 404
			) {
				// No published config exists yet
				return NextResponse.json({
					config: null,
					message: 'No published configuration found',
				});
			}

			console.error('S3 error:', s3Error);
			return NextResponse.json(
				{ error: 'Failed to fetch published config from S3' },
				{ status: 500 },
			);
		}
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}

		console.error('Error fetching published config:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch published config' },
			{ status: 500 },
		);
	}
}
