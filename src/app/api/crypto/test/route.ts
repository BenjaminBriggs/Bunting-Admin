import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import type { TestResult } from '@/lib/crypto-test-utils';
import {
	cleanupTestApp,
	createTestApp,
	runEndToEndCryptoTest,
	testKeyGeneration,
	testPublicKeyDistribution,
	validateJWSFormat,
} from '@/lib/crypto-test-utils';
import { logger } from '@/lib/logger';

/**
 * Guard the diagnostic endpoint: it does not exist in production (it mutates the
 * real DB with throwaway apps/keys), and is ADMIN-only elsewhere. Returns null
 * when the request may proceed, or a NextResponse to return directly.
 */
async function guardDiagnostic(
	request: NextRequest,
): Promise<NextResponse | null> {
	if (process.env.NODE_ENV === 'production') {
		return NextResponse.json({ error: 'Not found' }, { status: 404 });
	}
	const authz = await requireAdmin(request.headers);
	if (authz instanceof NextResponse) {
		return authz;
	}
	return null;
}

// GET /api/crypto/test - Run comprehensive crypto tests
export async function GET(request: NextRequest) {
	try {
		const guard = await guardDiagnostic(request);
		if (guard) {
			return guard;
		}

		const { searchParams } = new URL(request.url);
		const testType = searchParams.get('type') ?? 'full';

		switch (testType) {
			case 'keygen': {
				const keyGenResult = await testKeyGeneration();
				return NextResponse.json({
					test: 'Key Generation',
					result: keyGenResult,
					timestamp: new Date().toISOString(),
				});
			}

			case 'publickeys': {
				// Need an app for public key tests
				const publicKeyTestApp = await createTestApp();
				try {
					const publicKeyResult = await testPublicKeyDistribution(
						publicKeyTestApp.appId,
					);
					return NextResponse.json({
						test: 'Public Key Distribution',
						result: publicKeyResult,
						testApp: publicKeyTestApp.appIdentifier,
						timestamp: new Date().toISOString(),
					});
				} finally {
					await cleanupTestApp(publicKeyTestApp.appId);
				}
			}

			case 'full':
			default: {
				const fullTestResult = await runEndToEndCryptoTest();
				return NextResponse.json({
					test: 'End-to-End Crypto Test',
					results: fullTestResult,
					timestamp: new Date().toISOString(),
					summary: {
						overallSuccess: fullTestResult.overall.success,
						passedTests: (Object.values(fullTestResult) as TestResult[]).filter(
							(r) => r.success,
						).length,
						totalTests: Object.keys(fullTestResult).length,
					},
				});
			}
		}
	} catch (error) {
		logger.error({ err: error }, 'Crypto test failed');
		return NextResponse.json(
			{
				error: 'Crypto test failed',
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}

// POST /api/crypto/test - Test JWS validation with provided signature
export async function POST(request: NextRequest) {
	try {
		const guard = await guardDiagnostic(request);
		if (guard) {
			return guard;
		}

		const body = (await request.json()) as { jws?: unknown };
		const { jws } = body;

		if (!jws || typeof jws !== 'string') {
			return NextResponse.json(
				{ error: 'JWS signature is required' },
				{ status: 400 },
			);
		}

		// Validate JWS format. This only inspects the header — the admin has no
		// standalone verification path for a caller-supplied JWS (production
		// verification uses the detached signature bound to a specific config.json
		// upload, not a bare JWS + appId).
		const formatResult = validateJWSFormat(jws);

		return NextResponse.json({
			formatValidation: formatResult,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		logger.error({ err: error }, 'JWS validation test failed');
		return NextResponse.json(
			{
				error: 'JWS validation test failed',
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}
