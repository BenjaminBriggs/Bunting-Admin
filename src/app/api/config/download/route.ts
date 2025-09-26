import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const downloadConfigSchema = z.object({
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

// POST /api/config/download - Download published config file
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appIdentifier } = downloadConfigSchema.parse(body);

    const bucketName = process.env.S3_BUCKET;
    if (!bucketName) {
      return NextResponse.json({ error: 'S3_BUCKET not configured' }, { status: 500 });
    }

    // Get config from S3
    const configKey = `${appIdentifier}/config.json`;
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: configKey,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      return NextResponse.json({ error: 'Config file not found' }, { status: 404 });
    }

    const configContent = await response.Body.transformToString();
    const config = JSON.parse(configContent);

    // Generate filename with version
    const filename = `${appIdentifier}-v${config.config_version || 'latest'}.json`;

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
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }
    
    console.error('Error downloading config:', error);
    return NextResponse.json({ 
      error: 'Failed to download configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}