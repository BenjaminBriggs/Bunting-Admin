import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/keys/public - Get public keys for SDK verification
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');
    const appIdentifier = searchParams.get('appIdentifier');

    // Must provide either appId or appIdentifier
    if (!appId && !appIdentifier) {
      return NextResponse.json(
        { error: 'Either appId or appIdentifier parameter is required' },
        { status: 400 }
      );
    }

    // Find the app
    const whereClause = appId
      ? { id: appId }
      : { identifier: appIdentifier };

    const app = await prisma.app.findUnique({
      where: whereClause,
      select: {
        id: true,
        name: true,
        identifier: true,
      },
    });

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Get all signing keys (active and inactive for key rotation support)
    const signingKeys = await prisma.signingKey.findMany({
      where: { appId: app.id },
      select: {
        kid: true,
        publicKey: true,
        algorithm: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [
        { isActive: 'desc' }, // Active keys first
        { createdAt: 'desc' },  // Then by creation date
      ],
    });

    if (signingKeys.length === 0) {
      return NextResponse.json(
        { error: 'No signing keys found for this app' },
        { status: 404 }
      );
    }

    // Format response according to JSON Spec
    const publicKeys = signingKeys.map(key => ({
      kid: key.kid,
      pem: key.publicKey,
      algorithm: key.algorithm,
      active: key.isActive,
      created_at: key.createdAt.toISOString(),
    }));

    const response = NextResponse.json({
      app_identifier: app.identifier,
      keys: publicKeys,
      key_count: publicKeys.length,
      active_keys: publicKeys.filter(k => k.active).length,
      generated_at: new Date().toISOString(),
    });

    // Set caching headers for CDN distribution
    response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    response.headers.set('Content-Type', 'application/json');

    // CORS headers for SDK access
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
  } catch (error) {
    console.error('Failed to get public keys:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve public keys' },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}