import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const getPublishedConfigSchema = z.object({
  appIdentifier: z.string(),
});

// Configure AWS S3 Client
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true, // Required for MinIO compatibility
});

// POST /api/config/published - Get currently published config from S3
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appIdentifier } = getPublishedConfigSchema.parse(body);

    const bucketName = process.env.S3_BUCKET;
    if (!bucketName) {
      return NextResponse.json({ error: 'S3_BUCKET not configured' }, { status: 500 });
    }

    // Construct the S3 key for the config file
    const configKey = `${appIdentifier}/config.json`;

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: configKey
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        return NextResponse.json({ error: 'Config file is empty' }, { status: 404 });
      }

      const configContent = await response.Body.transformToString('utf-8');
      const publishedConfig = JSON.parse(configContent);

      return NextResponse.json({
        config: publishedConfig,
        lastModified: response.LastModified,
        etag: response.ETag
      });
    } catch (s3Error: any) {
      if (s3Error.name === 'NoSuchKey' || s3Error.$metadata?.httpStatusCode === 404) {
        // No published config exists yet
        return NextResponse.json({ 
          config: null,
          message: 'No published configuration found' 
        });
      }

      console.error('S3 error:', s3Error);
      return NextResponse.json({ 
        error: 'Failed to fetch published config from S3',
        details: s3Error.message 
      }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    console.error('Error fetching published config:', error);
    return NextResponse.json({ error: 'Failed to fetch published config' }, { status: 500 });
  }
}