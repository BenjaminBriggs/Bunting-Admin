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
 * Ensure an app has an ACTIVE signing key and at least one STANDBY key.
 *
 * - No ACTIVE key but a STANDBY one: promote the oldest STANDBY key. It has been
 *   in bootstrap files the longest, so the most shipped binaries trust it.
 *   Never mint a fresh ACTIVE key while a trusted one exists.
 * - No ACTIVE or STANDBY key at all (a new app, or one whose keys are all
 *   RETIRED): mint an ACTIVE key.
 * - Then, if no STANDBY key is left (e.g. an app migrated from the single-key
 *   model, or its last standby was promoted or retired): mint one, so every
 *   bootstrap file downloaded from now on already trusts the key a later
 *   rotation switches to.
 *
 * RETIRED keys are never re-activated. Runs on every publish and bootstrap
 * download; the common case (both keys present) is a single read.
 */
export async function ensureSigningKey(appId: string): Promise<void> {
	try {
		// Retry covers a race between the unlocked pre-check and the locked
		// re-check (e.g. a STANDBY key retired in between), which can need more
		// fresh keys than were minted.
		for (let attempt = 0; attempt < 3; attempt++) {
			const trusted = await prisma.signingKey.findMany({
				where: { appId, status: { in: ['ACTIVE', 'STANDBY'] } },
				select: { status: true },
			});
			const needed = keysToMint(trusted);
			if (needed === 0 && trusted.some((k) => k.status === 'ACTIVE')) {
				return;
			}

			// Generate outside the transaction (slow); discarded if another caller
			// wins the race.
			const fresh = await Promise.all(
				Array.from({ length: needed }, () => mintSigningKey()),
			);

			const done = await prisma.$transaction(async (tx) => {
				await lockAppSigningKeys(tx, appId);
				const current = await tx.signingKey.findMany({
					where: { appId, status: { in: ['ACTIVE', 'STANDBY'] } },
					select: { id: true, status: true },
					orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
				});
				if (keysToMint(current) > fresh.length) {
					return false;
				}

				let standbys = current.filter((k) => k.status === 'STANDBY');
				if (!current.some((k) => k.status === 'ACTIVE')) {
					if (standbys.length > 0) {
						await tx.signingKey.update({
							where: { id: standbys[0].id },
							data: { status: 'ACTIVE' },
						});
						standbys = standbys.slice(1);
					} else {
						await tx.signingKey.create({
							data: { appId, ...fresh.shift()!, status: 'ACTIVE' },
						});
					}
				}
				if (standbys.length === 0) {
					await tx.signingKey.create({
						data: { appId, ...fresh.shift()!, status: 'STANDBY' },
					});
				}
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
 * How many keys ensureSigningKey must mint for this set of ACTIVE/STANDBY keys:
 * one ACTIVE if there is nothing to promote, plus one STANDBY if none would be
 * left afterwards.
 */
function keysToMint(trusted: Array<{ status: SigningKeyStatus }>): number {
	const hasActive = trusted.some((k) => k.status === 'ACTIVE');
	const standbys = trusted.filter((k) => k.status === 'STANDBY').length;
	if (hasActive) {
		return standbys === 0 ? 1 : 0;
	}
	if (standbys === 0) {
		return 2;
	}
	// The oldest STANDBY is promoted; mint a replacement if it was the only one.
	return standbys === 1 ? 1 : 0;
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
 * The `public_keys` list for a bootstrap file (plist or JSON). Ensures the app
 * has an ACTIVE and a STANDBY key first, so every build made from the file can
 * survive one rotation, and the file never ships without a signing key.
 */
export async function getBootstrapPublicKeys(
	appId: string,
): Promise<Array<{ kid: string; pem: string }>> {
	await ensureSigningKey(appId);
	const keys = await getPublicKeysForApp(appId);
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
