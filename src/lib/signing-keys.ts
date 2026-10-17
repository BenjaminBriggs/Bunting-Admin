/**
 * Signing-key lifecycle: ACTIVE, STANDBY, RETIRED.
 *
 * Exactly one ACTIVE key per app signs publishes. STANDBY keys don't sign but
 * ship in the bootstrap file, so binaries built today already trust the key a
 * future rotation will switch to. RETIRED keys leave the bootstrap, can never
 * be re-activated, and are the only keys that can be deleted.
 *
 * Every mutation runs in a transaction holding a per-app advisory lock, so two
 * concurrent activations (or an activation racing ensureSigningKey) can't leave
 * an app with zero or two ACTIVE keys.
 *
 * Export/import moves a private key between instances as a passphrase-encrypted
 * file (see key-export.ts). Never log key material or passphrases from this
 * module.
 */

import 'server-only';
import { createPrivateKey, createPublicKey } from 'crypto';
import { NextResponse } from 'next/server';
import { Prisma, type SigningKeyStatus } from '@/generated/prisma/client';
import {
	generateRSAKeyPair,
	validateKeyId,
	validatePrivateKeyPEM,
} from './crypto';
import { prisma } from './db';
import {
	KeyExportDecryptionError,
	openSigningKey,
	sealSigningKey,
	type SigningKeyExport,
} from './key-export';
import { loadPrivateKey, storePrivateKey } from './key-protection';

/** A lifecycle rule violation the route maps straight to an HTTP status. */
export class SigningKeyError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 404 | 409,
	) {
		super(message);
		this.name = 'SigningKeyError';
	}
}

/** Map a SigningKeyError to its `{ error }` response, or null for anything else. */
export function signingKeyErrorResponse(error: unknown): NextResponse | null {
	if (error instanceof SigningKeyError) {
		return NextResponse.json(
			{ error: error.message },
			{ status: error.status },
		);
	}
	return null;
}

/** Serialize key mutations for one app (inside an interactive transaction). */
export async function lockAppSigningKeys(
	tx: Prisma.TransactionClient,
	appId: string,
): Promise<void> {
	const lockKey = `signing_keys:${appId}`;
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
}

/** A freshly generated key pair, with the private key already encrypted. */
export interface MintedSigningKey {
	kid: string;
	publicKey: string;
	privateKey: string;
	algorithm: string;
}

/**
 * Generate a key pair and encrypt its private key for storage. Done outside
 * any transaction: RSA generation and KMS calls are too slow to hold a lock for.
 */
export async function mintSigningKey(): Promise<MintedSigningKey> {
	const keyPair = await generateRSAKeyPair();
	return {
		kid: keyPair.kid,
		publicKey: keyPair.publicKey,
		privateKey: await storePrivateKey(keyPair.privateKey),
		algorithm: keyPair.algorithm,
	};
}

const publicKeySelect = {
	id: true,
	kid: true,
	publicKey: true,
	algorithm: true,
	status: true,
	createdAt: true,
} as const;

export type PublicSigningKey = Prisma.SigningKeyGetPayload<{
	select: typeof publicKeySelect;
}>;

/** List an app's keys (never the private key), ACTIVE, then STANDBY, then RETIRED. */
export async function listSigningKeys(
	appId: string,
): Promise<PublicSigningKey[]> {
	const keys = await prisma.signingKey.findMany({
		where: { appId },
		select: publicKeySelect,
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
	});
	return sortByStatus(keys);
}

const STATUS_ORDER: Record<SigningKeyStatus, number> = {
	ACTIVE: 0,
	STANDBY: 1,
	RETIRED: 2,
};

/** Stable sort by lifecycle status, keeping the incoming order within a status. */
export function sortByStatus<T extends { status: SigningKeyStatus }>(
	keys: T[],
): T[] {
	return [...keys].sort(
		(a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
	);
}

/** Create a new STANDBY key. New keys never sign until explicitly activated. */
export async function createStandbySigningKey(
	appId: string,
): Promise<PublicSigningKey> {
	const minted = await mintSigningKey();
	return prisma.$transaction(async (tx) => {
		await lockAppSigningKeys(tx, appId);
		return tx.signingKey.create({
			data: { appId, ...minted, status: 'STANDBY' },
			select: publicKeySelect,
		});
	});
}

/**
 * Make a STANDBY key the signing key. The previous ACTIVE key drops to STANDBY
 * (still trusted), atomically. Activating the already-active key is a no-op.
 */
export async function activateSigningKey(
	appId: string,
	kid: string,
): Promise<{
	changed: boolean;
	keyId: string;
	previousActiveKid: string | null;
}> {
	return prisma.$transaction(async (tx) => {
		await lockAppSigningKeys(tx, appId);
		const target = await tx.signingKey.findUnique({
			where: { appId_kid: { appId, kid } },
			select: { id: true, status: true },
		});
		if (!target) {
			throw new SigningKeyError('Signing key not found', 404);
		}
		if (target.status === 'ACTIVE') {
			return { changed: false, keyId: target.id, previousActiveKid: null };
		}
		if (target.status === 'RETIRED') {
			throw new SigningKeyError(
				'Retired signing keys cannot be re-activated. Activate a standby key instead.',
				409,
			);
		}

		const previous = await tx.signingKey.findFirst({
			where: { appId, status: 'ACTIVE' },
			select: { kid: true },
		});
		await tx.signingKey.updateMany({
			where: { appId, status: 'ACTIVE' },
			data: { status: 'STANDBY' },
		});
		await tx.signingKey.update({
			where: { id: target.id },
			data: { status: 'ACTIVE' },
		});
		return {
			changed: true,
			keyId: target.id,
			previousActiveKid: previous?.kid ?? null,
		};
	});
}

/**
 * Retire a STANDBY key: it leaves the bootstrap file and can never sign again.
 * The ACTIVE key can't be retired; activate another key first. Retiring an
 * already-retired key is a no-op.
 */
export async function retireSigningKey(
	appId: string,
	kid: string,
): Promise<{ changed: boolean; keyId: string }> {
	return prisma.$transaction(async (tx) => {
		await lockAppSigningKeys(tx, appId);
		const target = await tx.signingKey.findUnique({
			where: { appId_kid: { appId, kid } },
			select: { id: true, status: true },
		});
		if (!target) {
			throw new SigningKeyError('Signing key not found', 404);
		}
		if (target.status === 'ACTIVE') {
			throw new SigningKeyError(
				'The active signing key cannot be retired. Activate a standby key first.',
				409,
			);
		}
		if (target.status === 'RETIRED') {
			return { changed: false, keyId: target.id };
		}
		await tx.signingKey.update({
			where: { id: target.id },
			data: { status: 'RETIRED' },
		});
		return { changed: true, keyId: target.id };
	});
}

/** Delete a RETIRED key. ACTIVE and STANDBY keys must never be deleted. */
export async function deleteSigningKey(
	appId: string,
	kid: string,
): Promise<{ keyId: string }> {
	return prisma.$transaction(async (tx) => {
		await lockAppSigningKeys(tx, appId);
		const target = await tx.signingKey.findUnique({
			where: { appId_kid: { appId, kid } },
			select: { id: true, status: true },
		});
		if (!target) {
			throw new SigningKeyError('Signing key not found', 404);
		}
		if (target.status !== 'RETIRED') {
			throw new SigningKeyError(
				'Only retired signing keys can be deleted. Retire the key first.',
				409,
			);
		}
		await tx.signingKey.delete({ where: { id: target.id } });
		return { keyId: target.id };
	});
}

// --- Export / import ---------------------------------------------------------
// The file format and its crypto live in key-export.ts.

/**
 * Export a key's private half, re-encrypted under an operator passphrase so it
 * can be stored offline or imported into another instance.
 */
export async function exportSigningKey(
	kid: string,
	passphrase: string,
): Promise<{ envelope: SigningKeyExport; appId: string; keyId: string }> {
	const key = await prisma.signingKey.findUnique({
		where: { kid },
		select: {
			id: true,
			appId: true,
			kid: true,
			privateKey: true,
			algorithm: true,
			status: true,
			createdAt: true,
			app: { select: { identifier: true } },
		},
	});
	if (!key) {
		throw new SigningKeyError('Signing key not found', 404);
	}

	const pem = await loadPrivateKey(key.privateKey);
	const pkcs8Der = createPrivateKey(pem).export({
		type: 'pkcs8',
		format: 'der',
	});
	const envelope = await sealSigningKey(
		pkcs8Der,
		{
			appIdentifier: key.app.identifier,
			kid: key.kid,
			algorithm: 'RS256',
			status: key.status,
			createdAt: key.createdAt.toISOString(),
		},
		passphrase,
	);

	return { appId: key.appId, keyId: key.id, envelope };
}

/**
 * Import an exported key into `appId` as STANDBY. The kid is preserved so
 * binaries that already trust it keep verifying once it is activated.
 */
export async function importSigningKey(
	appId: string,
	envelope: SigningKeyExport,
	passphrase: string,
): Promise<PublicSigningKey> {
	// kids are random 16-byte lowercase hex (generateKeyId); nothing else is ours.
	if (
		!validateKeyId(envelope.kid) ||
		envelope.kid !== envelope.kid.toLowerCase()
	) {
		throw new SigningKeyError(
			'Invalid key ID: expected 32 lowercase hexadecimal characters',
			400,
		);
	}
	let pkcs8Der: Buffer;
	try {
		pkcs8Der = await openSigningKey(envelope, passphrase);
	} catch (error) {
		if (error instanceof KeyExportDecryptionError) {
			// Deliberately generic: a wrong passphrase and a tampered file look the same.
			throw new SigningKeyError(
				'Could not decrypt the key. Check the passphrase and that the file is an unmodified Bunting key export.',
				400,
			);
		}
		throw error;
	}

	let keyObject: ReturnType<typeof createPrivateKey>;
	try {
		keyObject = createPrivateKey({
			key: pkcs8Der,
			format: 'der',
			type: 'pkcs8',
		});
	} catch {
		throw new SigningKeyError(
			'The key file does not contain a valid PKCS#8 private key',
			400,
		);
	}

	if (keyObject.asymmetricKeyType !== 'rsa') {
		throw new SigningKeyError('Only RSA signing keys are supported', 400);
	}
	if ((keyObject.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
		throw new SigningKeyError(
			'RSA signing keys must be at least 2048 bits',
			400,
		);
	}

	const pem = keyObject.export({ type: 'pkcs8', format: 'pem' });
	if (!validatePrivateKeyPEM(pem)) {
		throw new SigningKeyError('The key is not a valid PKCS#8 private key', 400);
	}
	const publicKey = createPublicKey({ key: pem, format: 'pem' }).export({
		type: 'spki',
		format: 'pem',
	});
	const protectedPrivateKey = await storePrivateKey(pem);

	try {
		return await prisma.$transaction(async (tx) => {
			await lockAppSigningKeys(tx, appId);
			const duplicate = await tx.signingKey.findFirst({
				where: { OR: [{ kid: envelope.kid }, { publicKey }] },
				select: { kid: true },
			});
			if (duplicate) {
				throw new SigningKeyError(
					duplicate.kid === envelope.kid
						? 'A signing key with this key ID already exists on this instance'
						: `This key is already stored on this instance as ${duplicate.kid}`,
					409,
				);
			}
			return tx.signingKey.create({
				data: {
					appId,
					kid: envelope.kid,
					privateKey: protectedPrivateKey,
					publicKey,
					algorithm: 'RS256',
					status: 'STANDBY',
				},
				select: publicKeySelect,
			});
		});
	} catch (error) {
		// A concurrent import of the same kid on another app (the kid is unique
		// instance-wide, the lock is per app).
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2002'
		) {
			throw new SigningKeyError(
				'A signing key with this key ID already exists on this instance',
				409,
			);
		}
		throw error;
	}
}
