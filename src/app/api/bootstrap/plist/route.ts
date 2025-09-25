import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Generate BuntingConfig.plist for iOS/macOS SDK
 *
 * This endpoint creates a properly formatted plist file containing:
 * - endpoint_url: The artifact URL for config fetching
 * - public_keys: Array of signing keys for JWS verification
 * - fetch_policy: Polling intervals and TTL settings
 *
 * The plist format follows Apple's Property List DTD and is compatible
 * with the Bunting Swift SDK bootstrap requirements.
 *
 * @route GET /api/bootstrap/plist
 * @param {string} appId - Application ID (query parameter)
 * @param {string} appIdentifier - Application identifier (query parameter, alternative to appId)
 * @returns {Response} BuntingConfig.plist file download
 */
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
        artifactUrl: true,
        publicKeys: true,
        fetchPolicy: true,
      },
    });

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Get all active signing keys
    const signingKeys = await prisma.signingKey.findMany({
      where: {
        appId: app.id,
        isActive: true
      },
      select: {
        kid: true,
        publicKey: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // If no signing keys in database, fall back to publicKeys stored on app
    let publicKeysArray: { kid: string; pem: string }[];

    if (signingKeys.length > 0) {
      publicKeysArray = signingKeys.map(key => ({
        kid: key.kid,
        pem: key.publicKey,
      }));
    } else {
      // Fall back to app.publicKeys
      const appPublicKeys = app.publicKeys as { kid: string; pem: string }[];
      if (!appPublicKeys || appPublicKeys.length === 0) {
        return NextResponse.json(
          { error: 'No signing keys found for this app' },
          { status: 404 }
        );
      }
      publicKeysArray = appPublicKeys;
    }

    // Parse fetch policy with defaults
    const fetchPolicy = app.fetchPolicy as { min_interval_seconds?: number; hard_ttl_days?: number } || {};
    const minIntervalSeconds = fetchPolicy.min_interval_seconds || 21600; // 6 hours default
    const hardTtlDays = fetchPolicy.hard_ttl_days || 7; // 7 days default

    // publicKeysArray is already defined above

    // Generate plist XML content according to SDK specification
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>endpoint_url</key>
\t<string>${app.artifactUrl}</string>
\t<key>public_keys</key>
\t<array>
${publicKeysArray.map(key => `\t\t<dict>
\t\t\t<key>kid</key>
\t\t\t<string>${key.kid}</string>
\t\t\t<key>pem</key>
\t\t\t<string>${key.pem}</string>
\t\t</dict>`).join('\n')}
\t</array>
\t<key>fetch_policy</key>
\t<dict>
\t\t<key>min_interval_seconds</key>
\t\t<integer>${minIntervalSeconds}</integer>
\t\t<key>hard_ttl_days</key>
\t\t<integer>${hardTtlDays}</integer>
\t</dict>
</dict>
</plist>`;

    const response = new NextResponse(plistContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-plist',
        'Content-Disposition': `attachment; filename="BuntingConfig.plist"`,
        'Cache-Control': 'private, no-cache', // Don't cache plist files
      },
    });

    return response;
  } catch (error) {
    console.error('Failed to generate plist:', error);
    return NextResponse.json(
      { error: 'Failed to generate bootstrap plist' },
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