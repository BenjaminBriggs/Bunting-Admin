/**
 * JWS (JSON Web Signature) signing service for config authentication
 *
 * This module implements RS256 JWS signing as specified in the JSON Spec,
 * ensuring config integrity and authenticity for SDK clients.
 */

import 'server-only';
import { importPKCS8 } from 'jose';
import { logger } from '@/lib/logger';
import { generateRSAKeyPair } from './crypto';
import { prisma } from './db';
import { signDetached } from './detached-signature';
import { loadPrivateKey, storePrivateKey } from './key-protection';

export interface SigningResult {
	signature: string; // Compact JWS string
	keyId: string; // Key ID used for signing
	algorithm: string; // Signing algorithm (RS256)
}

/**
 * Ensure an app has at least one active signing key, generating one if needed.
 * Activates an existing inactive key before minting a new one.
 */
export async function ensureSigningKey(appId: string): Promise<void> {
	try {
		const existingActiveKey = await prisma.signingKey.findFirst({
			where: { appId, isActive: true },
		});
		if (existingActiveKey) {
			return;
		}

		const existingInactiveKey = await prisma.signingKey.findFirst({
			where: { appId, isActive: false },
		});
		if (existingInactiveKey) {
			await prisma.signingKey.update({
				where: { id: existingInactiveKey.id },
				data: { isActive: true },
			});
			return;
		}

		const keyPair = await generateRSAKeyPair();
		await prisma.signingKey.create({
			data: {
				appId,
				kid: keyPair.kid,
				privateKey: await storePrivateKey(keyPair.privateKey),
				publicKey: keyPair.publicKey,
				algorithm: keyPair.algorithm,
				isActive: true,
			},
		});
	} catch (error) {
		logger.error({ err: error }, 'Failed to ensure signing key');
		throw new Error('Failed to ensure signing key exists');
	}
}

/**
 * Sign the EXACT config bytes with a detached JWS (RFC 7797).
 *
 * This is what the publish pipeline uses: the signature binds to the precise
 * bytes uploaded as config.json, and the SDK verifies its fetched bytes against
 * it. `configString` MUST be the identical string uploaded to storage.
 */
export async function signConfigDetached(
	appId: string,
	configString: string,
): Promise<SigningResult> {
	const signingKey = await prisma.signingKey.findFirst({
		where: { appId, isActive: true },
		orderBy: { createdAt: 'desc' },
	});

	if (!signingKey) {
		throw new Error(`No active signing key found for app ${appId}`);
	}

	const privateKeyPem = await loadPrivateKey(signingKey.privateKey);
	const privateKey = await importPKCS8(privateKeyPem, signingKey.algorithm);

	const signature = await signDetached(configString, privateKey, {
		alg: signingKey.algorithm,
		kid: signingKey.kid,
	});

	return { signature, keyId: signingKey.kid, algorithm: signingKey.algorithm };
}

/**
 * Get all public keys for an app (for distribution to SDKs)
 */
export async function getPublicKeysForApp(appId: string): Promise<
	Array<{
		kid: string;
		pem: string;
		algorithm: string;
		isActive: boolean;
	}>
> {
	try {
		const signingKeys = await prisma.signingKey.findMany({
			where: { appId },
			select: {
				kid: true,
				publicKey: true,
				algorithm: true,
				isActive: true,
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		return signingKeys.map((key) => ({
			kid: key.kid,
			pem: key.publicKey,
			algorithm: key.algorithm,
			isActive: key.isActive,
		}));
	} catch (error) {
		logger.error({ err: error }, 'Failed to get public keys');
		throw new Error('Failed to retrieve public keys');
	}
}

/**
 * Rotate signing keys for an app
 * Deactivates the current key and activates a new one
 */
export async function rotateSigningKeys(
	appId: string,
	newKeyId: string,
): Promise<void> {
	try {
		await prisma.$transaction(async (tx) => {
			// Deactivate all existing keys
			await tx.signingKey.updateMany({
				where: { appId, isActive: true },
				data: { isActive: false },
			});

			// Activate the new key (throws P2025 if the key does not exist)
			await tx.signingKey.update({
				where: { appId_kid: { appId, kid: newKeyId } },
				data: { isActive: true },
			});
		});
	} catch (error) {
		logger.error({ err: error }, 'Key rotation failed');
		throw new Error(
			`Failed to rotate keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
		);
	}
}

/**
 * A parsed JWS protected header. Only the standard fields are typed; the index
 * signature allows additional/critical parameters.
 */
export interface JWSHeader {
	alg?: string;
	kid?: string;
	typ?: string;
	[key: string]: unknown;
}

/**
 * Utility functions for JWS header inspection
 */
export class JWSUtils {
	/**
	 * Parse JWS header without verification
	 */
	static parseHeader(jwsCompact: string): JWSHeader {
		try {
			const [headerB64] = jwsCompact.split('.');
			const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
			return JSON.parse(headerJson) as JWSHeader;
		} catch {
			throw new Error('Invalid JWS format');
		}
	}

	/**
	 * Extract Key ID from JWS header
	 */
	static extractKeyId(jwsCompact: string): string | null {
		try {
			const header = this.parseHeader(jwsCompact);
			return header.kid ?? null;
		} catch {
			return null;
		}
	}

	/**
	 * Validate JWS format
	 */
	static isValidJWSFormat(jwsCompact: string): boolean {
		const parts = jwsCompact.split('.');
		return parts.length === 3; // header.payload.signature
	}
}
