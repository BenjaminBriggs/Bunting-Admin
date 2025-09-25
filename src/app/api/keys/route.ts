import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateRSAKeyPair, KeySecurity } from '@/lib/crypto';

const createKeySchema = z.object({
  appId: z.string(),
  isActive: z.boolean().optional().default(false),
});

const rotateKeySchema = z.object({
  appId: z.string(),
  newKeyId: z.string(),
});

// GET /api/keys - List signing keys for an app
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');

    if (!appId) {
      return NextResponse.json({ error: 'appId parameter is required' }, { status: 400 });
    }

    // Verify app exists
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { id: true, name: true },
    });

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Get signing keys (exclude private keys from response)
    const signingKeys = await prisma.signingKey.findMany({
      where: { appId },
      select: {
        id: true,
        kid: true,
        publicKey: true,
        algorithm: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      app: app.name,
      keys: signingKeys.map(key => ({
        ...key,
        // Sanitize for logging safety
        ...KeySecurity.sanitizeKeyForLogging(key),
      })),
    });
  } catch (error) {
    console.error('Failed to list signing keys:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve signing keys' },
      { status: 500 }
    );
  }
}

// POST /api/keys - Create a new signing key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, isActive } = createKeySchema.parse(body);

    // Verify app exists
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { id: true },
    });

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Generate new RSA key pair
    const keyPair = await generateRSAKeyPair();

    // If this key should be active, deactivate other keys first
    await prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.signingKey.updateMany({
          where: { appId, isActive: true },
          data: { isActive: false },
        });
      }

      // Create the new signing key
      await tx.signingKey.create({
        data: {
          appId,
          kid: keyPair.kid,
          privateKey: keyPair.privateKey,
          publicKey: keyPair.publicKey,
          algorithm: keyPair.algorithm,
          isActive,
        },
      });
    });

    // Return public information only
    return NextResponse.json({
      kid: keyPair.kid,
      publicKey: keyPair.publicKey,
      algorithm: keyPair.algorithm,
      isActive,
      message: 'Signing key created successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to create signing key:', error);
    return NextResponse.json(
      { error: 'Failed to create signing key' },
      { status: 500 }
    );
  }
}

// PUT /api/keys - Rotate signing keys
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, newKeyId } = rotateKeySchema.parse(body);

    // Verify app exists
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { id: true },
    });

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Verify the new key exists
    const newKey = await prisma.signingKey.findUnique({
      where: { appId_kid: { appId, kid: newKeyId } },
      select: { id: true, kid: true },
    });

    if (!newKey) {
      return NextResponse.json({ error: 'New key not found' }, { status: 404 });
    }

    // Perform key rotation
    await prisma.$transaction(async (tx) => {
      // Deactivate all keys for this app
      await tx.signingKey.updateMany({
        where: { appId, isActive: true },
        data: { isActive: false },
      });

      // Activate the new key
      await tx.signingKey.update({
        where: { appId_kid: { appId, kid: newKeyId } },
        data: { isActive: true },
      });
    });

    return NextResponse.json({
      message: 'Key rotation completed successfully',
      activeKeyId: newKeyId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to rotate signing keys:', error);
    return NextResponse.json(
      { error: 'Failed to rotate signing keys' },
      { status: 500 }
    );
  }
}