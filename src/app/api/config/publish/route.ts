import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { generateConfigFromDb } from '@/lib/config-generator';
import { prisma } from '@/lib/db';
import { getConfigChanges } from '@/lib/config-comparison';

const publishConfigSchema = z.object({
  appId: z.string(),
  changelog: z.string().min(1, 'Changelog is required'),
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

// POST /api/config/publish - Publish configuration to S3
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, changelog } = publishConfigSchema.parse(body);

    const bucketName = process.env.S3_BUCKET;
    if (!bucketName) {
      return NextResponse.json({ error: 'S3_BUCKET not configured' }, { status: 500 });
    }

    // Generate current config
    const baseConfig = await generateConfigFromDb(appId);
    
    // Get app identifier from the config
    const appIdentifier = baseConfig.app_identifier;
    
    // Generate version number
    const version = await generateNextVersion(appId, appIdentifier);
    
    // Get previous published config for comparison
    const previousConfig = await getPublishedConfigFromS3(appIdentifier).catch(() => ({ config: null }));
    const configChanges = getConfigChanges(baseConfig, previousConfig.config);
    
    // Create final publishable config
    const publishedConfig = {
      ...baseConfig,
      config_version: version,
      published_at: new Date().toISOString(),
      metadata: {
        changelog,
        published_by: 'admin@example.com', // TODO: Get from auth session
      }
    };

    // Upload to S3
    const configKey = `${appIdentifier}/config.json`;
    const configContent = JSON.stringify(publishedConfig, null, 2);
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: configKey,
      Body: configContent,
      ContentType: 'application/json',
      CacheControl: 'max-age=300, stale-while-revalidate=86400',
    });

    await s3Client.send(command);

    // Store publish history in database
    await storePublishHistory({
      appId,
      version,
      changelog,
      publishedBy: 'admin@example.com',
      configContent: publishedConfig,
      changes: configChanges
    });

    return NextResponse.json({
      version,
      publishedAt: publishedConfig.published_at,
      message: 'Configuration published successfully'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    console.error('Error publishing config:', error);
    return NextResponse.json({ 
      error: 'Failed to publish configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function generateNextVersion(appId: string, appIdentifier: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Query database for existing versions today
  const existingVersions = await prisma.auditLog.findMany({
    where: {
      appId,
      configVersion: {
        startsWith: today
      }
    },
    select: {
      configVersion: true
    },
    orderBy: {
      configVersion: 'desc'
    }
  });
  
  // Find the highest version number for today
  let maxVersionNumber = 0;
  for (const version of existingVersions) {
    const versionParts = version.configVersion.split('.');
    if (versionParts.length === 2 && versionParts[0] === today) {
      const versionNumber = parseInt(versionParts[1], 10);
      if (versionNumber > maxVersionNumber) {
        maxVersionNumber = versionNumber;
      }
    }
  }
  
  return `${today}.${maxVersionNumber + 1}`;
}

async function storePublishHistory(data: {
  appId: string;
  version: string;
  changelog: string;
  publishedBy: string;
  configContent: any;
  changes: any[];
}) {
  // Count flags and cohorts in config
  const flagCount = Object.keys(data.configContent.flags || {}).length;
  const cohortCount = Object.keys(data.configContent.cohorts || {}).length;
  
  // Store in audit log
  await prisma.auditLog.create({
    data: {
      appId: data.appId,
      configVersion: data.version,
      publishedAt: new Date(),
      publishedBy: data.publishedBy,
      changelog: data.changelog,
      configDiff: {
        changes: data.changes,
        flagCount,
        cohortCount,
        configSize: JSON.stringify(data.configContent).length
      },
      artifactSize: JSON.stringify(data.configContent).length,
    }
  });
}

async function getPublishedConfigFromS3(appIdentifier: string): Promise<{ config: any | null }> {
  const bucketName = process.env.S3_BUCKET;
  if (!bucketName) {
    throw new Error('S3_BUCKET not configured');
  }

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