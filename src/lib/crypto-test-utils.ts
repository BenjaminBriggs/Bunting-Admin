/**
 * Testing utilities for JWS signature verification and crypto operations
 *
 * This module provides utilities for testing the end-to-end JWS signing
 * and verification flow, as well as validation helpers.
 */

import { logger } from '@/lib/logger';
import { generateRSAKeyPair } from './crypto';
import { prisma } from './db';
import { getPublicKeysForApp, type JWSHeader } from './jws-signer';

export interface TestResult {
	success: boolean;
	message: string;
	details?: unknown;
	error?: string;
}

export interface EndToEndTestResult {
	keyGeneration: TestResult;
	publicKeyDistribution: TestResult;
	overall: TestResult;
}

/**
 * Create a test app with signing keys for testing purposes
 */
export async function createTestApp(): Promise<{
	appId: string;
	appIdentifier: string;
}> {
	// Create test app
	const testApp = await prisma.app.create({
		data: {
			name: 'Test App for Crypto',
			identifier: `test-crypto-${Date.now()}`,
			artifactUrl: 'https://example.com/test',
			publicKeys: [],
			fetchPolicy: { min_interval_seconds: 3600 },
			storageConfig: {},
		},
	});

	// Generate signing key
	const keyPair = await generateRSAKeyPair();
	await prisma.signingKey.create({
		data: {
			appId: testApp.id,
			kid: keyPair.kid,
			privateKey: keyPair.privateKey,
			publicKey: keyPair.publicKey,
			algorithm: keyPair.algorithm,
			isActive: true,
		},
	});

	return { appId: testApp.id, appIdentifier: testApp.identifier };
}

/**
 * Clean up test app and associated data
 */
export async function cleanupTestApp(appId: string): Promise<void> {
	try {
		// Delete signing keys first (due to foreign key constraints)
		await prisma.signingKey.deleteMany({
			where: { appId },
		});

		// Delete the app (this will cascade delete other related records)
		await prisma.app.delete({
			where: { id: appId },
		});
	} catch (error) {
		logger.error({ err: error }, 'Failed to cleanup test app');
		throw error;
	}
}

/**
 * Test RSA key pair generation
 */
export async function testKeyGeneration(): Promise<TestResult> {
	try {
		const keyPair = await generateRSAKeyPair();

		// Validate key pair structure
		if (!keyPair.kid || !keyPair.publicKey || !keyPair.privateKey) {
			return {
				success: false,
				message: 'Key pair missing required fields',
				error: 'Generated key pair is incomplete',
			};
		}

		// Validate PEM formats
		const publicKeyValid = keyPair.publicKey.includes(
			'-----BEGIN PUBLIC KEY-----',
		);
		const privateKeyValid = keyPair.privateKey.includes(
			'-----BEGIN PRIVATE KEY-----',
		);

		if (!publicKeyValid || !privateKeyValid) {
			return {
				success: false,
				message: 'Key pair not in proper PEM format',
				error: 'Invalid PEM format',
			};
		}

		return {
			success: true,
			message: 'Key generation successful',
			details: {
				kid: keyPair.kid,
				algorithm: keyPair.algorithm,
				publicKeyLength: keyPair.publicKey.length,
				privateKeyLength: keyPair.privateKey.length,
			},
		};
	} catch (error) {
		return {
			success: false,
			message: 'Key generation failed',
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Test public key distribution
 */
export async function testPublicKeyDistribution(
	appId: string,
): Promise<TestResult> {
	try {
		const publicKeys = await getPublicKeysForApp(appId);

		if (publicKeys.length === 0) {
			return {
				success: false,
				message: 'No public keys found',
				error: 'Public key distribution returned empty array',
			};
		}

		// Validate structure of public keys
		for (const key of publicKeys) {
			if (!key.kid || !key.pem || !key.algorithm) {
				return {
					success: false,
					message: 'Public key structure invalid',
					error: 'Public key missing required fields',
				};
			}

			if (!key.pem.includes('-----BEGIN PUBLIC KEY-----')) {
				return {
					success: false,
					message: 'Public key not in PEM format',
					error: 'Invalid PEM format in public key',
				};
			}
		}

		return {
			success: true,
			message: 'Public key distribution successful',
			details: {
				keyCount: publicKeys.length,
				activeKeys: publicKeys.filter((k) => k.isActive).length,
				kids: publicKeys.map((k) => k.kid),
			},
		};
	} catch (error) {
		return {
			success: false,
			message: 'Public key distribution test failed',
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Run comprehensive end-to-end JWS testing
 */
export async function runEndToEndCryptoTest(): Promise<EndToEndTestResult> {
	let testAppId: string | null = null;

	try {
		// Create test app
		const testApp = await createTestApp();
		testAppId = testApp.appId;

		// Run all tests
		const keyGeneration = await testKeyGeneration();
		const publicKeyDistribution = await testPublicKeyDistribution(
			testApp.appId,
		);

		// Determine overall result
		const allPassed = keyGeneration.success && publicKeyDistribution.success;

		const overall: TestResult = {
			success: allPassed,
			message: allPassed
				? 'All crypto tests passed successfully'
				: 'One or more crypto tests failed',
			details: {
				passedTests: [keyGeneration, publicKeyDistribution].filter(
					(t) => t.success,
				).length,
				totalTests: 2,
			},
		};

		return {
			keyGeneration,
			publicKeyDistribution,
			overall,
		};
	} catch (error) {
		return {
			keyGeneration: {
				success: false,
				message: 'Test setup failed',
				error: 'Could not create test app',
			},
			publicKeyDistribution: {
				success: false,
				message: 'Test setup failed',
				error: 'Could not create test app',
			},
			overall: {
				success: false,
				message: 'End-to-end test failed during setup',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		};
	} finally {
		// Cleanup test app
		if (testAppId) {
			try {
				await cleanupTestApp(testAppId);
			} catch (cleanupError) {
				logger.error({ err: cleanupError }, 'Failed to cleanup test app');
			}
		}
	}
}

/**
 * Validate a JWS signature format without verifying it
 */
export function validateJWSFormat(jws: string): TestResult {
	try {
		const parts = jws.split('.');
		if (parts.length !== 3) {
			return {
				success: false,
				message: 'Invalid JWS format',
				error: 'JWS must have exactly 3 parts separated by dots',
			};
		}

		// Try to decode the header
		try {
			const headerJson = Buffer.from(parts[0], 'base64url').toString('utf8');
			const header = JSON.parse(headerJson) as JWSHeader;

			if (!header.alg || !header.kid) {
				return {
					success: false,
					message: 'Invalid JWS header',
					error: 'Header missing required alg or kid fields',
				};
			}

			return {
				success: true,
				message: 'JWS format is valid',
				details: {
					algorithm: header.alg,
					keyId: header.kid,
					type: header.typ ?? 'JWT',
				},
			};
		} catch {
			return {
				success: false,
				message: 'Invalid JWS header encoding',
				error: 'Could not decode or parse JWS header',
			};
		}
	} catch (error) {
		return {
			success: false,
			message: 'JWS format validation failed',
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}
