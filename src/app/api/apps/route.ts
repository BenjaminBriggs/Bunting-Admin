import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateConfigFromDb } from '@/lib/config-generator';

const createAppSchema = z.object({
  name: z.string(),
  identifier: z.string(),
  artifactUrl: z.string(),
  publicKeys: z.array(z.object({
    kid: z.string(),
    pem: z.string()
  })),
  fetchPolicy: z.object({
    min_interval_seconds: z.number(),
    hard_ttl_days: z.number()
  }),
  storageConfig: z.object({
    bucket: z.string(),
    region: z.string(),
    endpoint: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional()
  })
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

async function publishInitialConfig(appId: string): Promise<void> {
  const bucketName = process.env.S3_BUCKET;
  if (!bucketName) {
    throw new Error('S3_BUCKET not configured');
  }

  // Generate initial config
  const baseConfig = await generateConfigFromDb(appId);
  const appIdentifier = baseConfig.app_identifier;
  
  // Create initial config with version 1.0
  const publishedConfig = {
    ...baseConfig,
    config_version: new Date().toISOString().split('T')[0] + '.1',
    published_at: new Date().toISOString(),
  };

  const configKey = `${appIdentifier}/config.json`;

  try {
    // Upload config to S3
    const putConfigCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: configKey,
      Body: JSON.stringify(publishedConfig, null, 2),
      ContentType: 'application/json',
      CacheControl: 'max-age=300', // 5 minutes
    });

    await s3Client.send(putConfigCommand);

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        appId,
        configVersion: publishedConfig.config_version,
        publishedAt: new Date(),
        publishedBy: 'system',
        changelog: 'Initial application configuration',
        configDiff: {},
        artifactSize: JSON.stringify(publishedConfig).length
      }
    });
  } catch (error) {
    console.error('Error publishing initial config:', error);
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
            cohorts: true,
            testRollouts: true
          }
        }
      }
    });

    return NextResponse.json(apps);
  } catch (error) {
    console.error('Error fetching apps:', error);
    return NextResponse.json({ error: 'Failed to fetch apps' }, { status: 500 });
  }
}

// POST /api/apps - Create a new app
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createAppSchema.parse(body);

    // Check if app identifier already exists
    const existingApp = await prisma.app.findUnique({
      where: { identifier: validatedData.identifier }
    });

    if (existingApp) {
      return NextResponse.json(
        { error: 'An app with this identifier already exists' },
        { status: 409 }
      );
    }

    const app = await prisma.app.create({
      data: validatedData,
      include: {
        _count: {
          select: {
            flags: true,
            cohorts: true,
            testRollouts: true
          }
        }
      }
    });

    // Publish initial empty config to validate storage settings
    try {
      await publishInitialConfig(app.id);
    } catch (error) {
      // If initial config publish fails, delete the app and return the error
      await prisma.app.delete({ where: { id: app.id } });
      console.error('Failed to publish initial config:', error);
      return NextResponse.json(
        { error: 'Failed to create initial configuration. Please check your storage settings.' },
        { status: 500 }
      );
    }

    return NextResponse.json(app, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    console.error('Error creating app:', error);
    return NextResponse.json({ error: 'Failed to create app' }, { status: 500 });
  }
}