import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const updateKeySchema = z.object({
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/keys/[id] - Get specific signing key details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: keyId } = params;
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');

    if (!appId) {
      return NextResponse.json({ error: 'appId parameter is required' }, { status: 400 });
    }

    // Get signing key (exclude private key from response)
    const signingKey = await prisma.signingKey.findUnique({
      where: { appId_kid: { appId, kid: keyId } },
      select: {
        id: true,
        kid: true,
        publicKey: true,
        algorithm: true,
        isActive: true,
        createdAt: true,
        app: {
          select: {
            id: true,
            name: true,
            identifier: true,
          },
        },
      },
    });

    if (!signingKey) {
      return NextResponse.json({ error: 'Signing key not found' }, { status: 404 });
    }

    return NextResponse.json({
      key: signingKey,
    });
  } catch (error) {
    console.error('Failed to get signing key:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve signing key' },
      { status: 500 }
    );
  }
}

// PUT /api/keys/[id] - Update signing key (activate/deactivate)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: keyId } = params;
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');

    if (!appId) {
      return NextResponse.json({ error: 'appId parameter is required' }, { status: 400 });
    }

    const body = await request.json();
    const { isActive } = updateKeySchema.parse(body);

    // Verify key exists
    const existingKey = await prisma.signingKey.findUnique({
      where: { appId_kid: { appId, kid: keyId } },
      select: { id: true, isActive: true },
    });

    if (!existingKey) {
      return NextResponse.json({ error: 'Signing key not found' }, { status: 404 });
    }

    // If activating this key, deactivate others
    await prisma.$transaction(async (tx) => {
      if (isActive && !existingKey.isActive) {
        // Deactivate all other keys for this app
        await tx.signingKey.updateMany({
          where: { appId, isActive: true },
          data: { isActive: false },
        });
      }

      // Update the target key
      await tx.signingKey.update({
        where: { appId_kid: { appId, kid: keyId } },
        data: { isActive },
      });
    });

    return NextResponse.json({
      message: 'Signing key updated successfully',
      keyId,
      isActive,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to update signing key:', error);
    return NextResponse.json(
      { error: 'Failed to update signing key' },
      { status: 500 }
    );
  }
}

// DELETE /api/keys/[id] - Delete signing key (must not be active)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: keyId } = params;
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');

    if (!appId) {
      return NextResponse.json({ error: 'appId parameter is required' }, { status: 400 });
    }

    // Verify key exists and is not active
    const existingKey = await prisma.signingKey.findUnique({
      where: { appId_kid: { appId, kid: keyId } },
      select: { id: true, isActive: true },
    });

    if (!existingKey) {
      return NextResponse.json({ error: 'Signing key not found' }, { status: 404 });
    }

    if (existingKey.isActive) {
      return NextResponse.json(
        { error: 'Cannot delete active signing key. Deactivate it first.' },
        { status: 400 }
      );
    }

    // Delete the key
    await prisma.signingKey.delete({
      where: { appId_kid: { appId, kid: keyId } },
    });

    return NextResponse.json({
      message: 'Signing key deleted successfully',
      keyId,
    });
  } catch (error) {
    console.error('Failed to delete signing key:', error);
    return NextResponse.json(
      { error: 'Failed to delete signing key' },
      { status: 500 }
    );
  }
}