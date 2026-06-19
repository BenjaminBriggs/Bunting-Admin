import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import type { TestResult } from '@/lib/crypto-test-utils';
import {
	cleanupTestApp,
	createTestApp,
	runEndToEndCryptoTest,
	testConfigSigning,
	testKeyGeneration,
	testPublicKeyDistribution,
	testSignatureVerification,
	validateJWSFormat,
} from '@/lib/crypto-test-utils';

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

			case 'signing': {
				// Need an app for signing tests
				const signingTestApp = await createTestApp();
				try {
					const signingResult = await testConfigSigning(signingTestApp.appId);
					return NextResponse.json({
						test: 'Config Signing',
						result: signingResult,
						testApp: signingTestApp.appIdentifier,
						timestamp: new Date().toISOString(),
					});
				} finally {
					await cleanupTestApp(signingTestApp.appId);
				}
			}

			case 'verification': {
				// Need an app for verification tests
				const verificationTestApp = await createTestApp();
				try {
					const verificationResult = await testSignatureVerification(
						verificationTestApp.appId,
					);
					return NextResponse.json({
						test: 'Signature Verification',
						result: verificationResult,
						testApp: verificationTestApp.appIdentifier,
						timestamp: new Date().toISOString(),
					});
				} finally {
					await cleanupTestApp(verificationTestApp.appId);
				}
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
						passedTests: (
							Object.values(fullTestResult) as TestResult[]
						).filter((r) => r.success).length,
						totalTests: Object.keys(fullTestResult).length,
					},
				});
			}
		}
	} catch (error) {
		console.error('Crypto test failed:', error);
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

		const body = (await request.json()) as {
			jws?: unknown;
			appId?: unknown;
			configJson?: unknown;
		};
		const { jws, appId, configJson } = body;

		if (!jws || typeof jws !== 'string') {
			return NextResponse.json(
				{ error: 'JWS signature is required' },
				{ status: 400 },
			);
		}

		// Validate JWS format
		const formatResult = validateJWSFormat(jws);

		const response: {
			formatValidation: ReturnType<typeof validateJWSFormat>;
			timestamp: string;
			verification?: {
				success: boolean;
				message: string;
				keyId?: string;
				error?: string;
			};
		} = {
			formatValidation: formatResult,
			timestamp: new Date().toISOString(),
		};

		// If appId and configJson are provided, attempt verification
		if (typeof appId === 'string' && configJson) {
			try {
				const { verifyConfigSignature } = await import('@/lib/jws-signer');
				const configString =
					typeof configJson === 'string'
						? configJson
						: JSON.stringify(configJson);

				const verificationResult = await verifyConfigSignature(
					configString,
					jws,
					appId,
				);

				response.verification = {
					success: verificationResult.verified,
					message: verificationResult.verified
						? 'Signature verification successful'
						: 'Signature verification failed',
					keyId: verificationResult.keyId,
					error: verificationResult.error,
				};
			} catch (verificationError) {
				response.verification = {
					success: false,
					message: 'Signature verification failed',
					error:
						verificationError instanceof Error
							? verificationError.message
							: 'Unknown verification error',
				};
			}
		}

		return NextResponse.json(response);
	} catch (error) {
		console.error('JWS validation test failed:', error);
		return NextResponse.json(
			{
				error: 'JWS validation test failed',
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}
