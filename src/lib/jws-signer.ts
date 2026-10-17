/**
 * JWS (JSON Web Signature) signing service for config authentication
 *
 * This module implements RS256 JWS signing as specified in the JSON Spec,
 * ensuring config integrity and authenticity for SDK clients.
 */

import 'server-only';
import { importPKCS8 } from 'jose';
import type { SigningKeyStatus } from '@/generated/prisma/client';
import { logger } from '@/lib/logger';
import { prisma } from './db';
import { signDetached } from './detached-signature';
import { loadPrivateKey } from './key-protection';
import {
	lockAppSigningKeys,
	mintSigningKey,
	sortByStatus,
} from './signing-keys';

export interface SigningResult {
	signature: string; // Compact JWS string
	keyId: string; // Key ID used for signing
	algorithm: string; // Signing algorithm (RS256)
}

/**
 * Ensure an app has an ACTIVE signing key.
 *
 * - An ACTIVE key exists: nothing to do.
 * - No ACTIVE key but a STANDBY one: promote the oldest STANDBY key. It has been
 *   in bootstrap files the longest, so the most shipped binaries trust it.
 *   Never mint a fresh key while a trusted one exists.
 * - No trusted key at all (a new app, or one whose keys are all RETIRED): mint an
 *   ACTIVE key plus a STANDBY key, so binaries built from the first bootstrap
 *   file already trust the key a later rotation switches to.
 *
 * RETIRED keys are never re-activated.
 */
export async function ensureSigningKey(appId: string): Promise<void> {
	try {
		// Two passes cover the one race that matters: a STANDBY key seen in the
		// pre-check is retired before we take the lock, so we need fresh keys.
		for (let attempt = 0; attempt < 2; attempt++) {
			const trusted = await prisma.signingKey.findMany({
				where: { appId, status: { in: ['ACTIVE', 'STANDBY'] } },
				select: { status: true },
			});
			if (trusted.some((k) => k.status === 'ACTIVE')) {
				return;
			}

			// Generate outside the transaction (slow); discarded if another caller
			// wins the race.
			const fresh =
				trusted.length === 0
					? await Promise.all([mintSigningKey(), mintSigningKey()])
					: null;

			const done = await prisma.$transaction(async (tx) => {
				await lockAppSigningKeys(tx, appId);
				const current = await tx.signingKey.findMany({
					where: { appId, status: { in: ['ACTIVE', 'STANDBY'] } },
					select: { id: true, status: true },
					orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
				});
				if (current.some((k) => k.status === 'ACTIVE')) {
					return true;
				}
				if (current.length > 0) {
					await tx.signingKey.update({
						where: { id: current[0].id },
						data: { status: 'ACTIVE' },
					});
					return true;
				}
				if (!fresh) {
					return false;
				}
				const [active, standby] = fresh;
				await tx.signingKey.create({
					data: { appId, ...active, status: 'ACTIVE' },
				});
				await tx.signingKey.create({
					data: { appId, ...standby, status: 'STANDBY' },
				});
				return true;
			});
			if (done) {
				return;
			}
		}
		throw new Error('Signing keys changed concurrently');
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
		where: { appId, status: 'ACTIVE' },
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
 * Public keys the SDK should trust for an app: every non-RETIRED key, ACTIVE
 * first, then STANDBY (newest first). This is what the bootstrap files embed.
 */
export async function getPublicKeysForApp(appId: string): Promise<
	Array<{
		kid: string;
		pem: string;
		algorithm: string;
		status: SigningKeyStatus;
		createdAt: Date;
	}>
> {
	try {
		const signingKeys = await prisma.signingKey.findMany({
			where: { appId, status: { in: ['ACTIVE', 'STANDBY'] } },
			select: {
				kid: true,
				publicKey: true,
				algorithm: true,
				status: true,
				createdAt: true,
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		});

		return sortByStatus(signingKeys).map((key) => ({
			kid: key.kid,
			pem: key.publicKey,
			algorithm: key.algorithm,
			status: key.status,
			createdAt: key.createdAt,
		}));
	} catch (error) {
		logger.error({ err: error }, 'Failed to get public keys');
		throw new Error('Failed to retrieve public keys');
	}
}

/**
 * The `public_keys` list for a bootstrap file (plist or JSON). An app with no
 * trusted key gets an ACTIVE + STANDBY pair minted first, so a bootstrap file
 * never ships without a key the publish pipeline can sign with.
 */
export async function getBootstrapPublicKeys(
	appId: string,
): Promise<Array<{ kid: string; pem: string }>> {
	let keys = await getPublicKeysForApp(appId);
	if (keys.length === 0) {
		await ensureSigningKey(appId);
		keys = await getPublicKeysForApp(appId);
	}
	return keys.map((key) => ({ kid: key.kid, pem: key.pem }));
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
