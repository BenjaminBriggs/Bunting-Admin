/**
 * Passphrase-encrypted file format for exported signing keys.
 *
 * The private key (PKCS#8 DER) is encrypted with AES-256-GCM under a key
 * derived from the operator's passphrase with scrypt (N=2^17, r=8, p=1, random
 * 16-byte salt). The KDF parameters travel in the file so they can be raised
 * later without breaking old exports. The key's metadata (app identifier, kid,
 * status, creation time) and the KDF/cipher parameters are bound as GCM
 * additional data, so editing any of them makes decryption fail.
 *
 * Pure crypto, no database access. Never log passphrases or decrypted keys.
 */

import 'server-only';
import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scrypt as scryptCallback,
} from 'crypto';
import { z } from 'zod';

export const KEY_EXPORT_FORMAT = 'bunting-signing-key' as const;
export const KEY_EXPORT_FORMAT_VERSION = 1 as const;
export const MIN_EXPORT_PASSPHRASE_LENGTH = 12;

/** scrypt cost used for new exports (about 128 MiB of memory per derivation). */
export const EXPORT_SCRYPT_PARAMS = { N: 2 ** 17, r: 8, p: 1 } as const;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

// Bounds accepted on import, so a crafted file can't make scrypt run too cheap
// or allocate unbounded memory (2^18 with r=8 is 256 MiB).
const MIN_SCRYPT_N = 2 ** 14;
const MAX_SCRYPT_N = 2 ** 18;

/** Passphrase rules shared by export and import. */
export const exportPassphraseSchema = z
	.string()
	.min(
		MIN_EXPORT_PASSPHRASE_LENGTH,
		`Passphrase must be at least ${MIN_EXPORT_PASSPHRASE_LENGTH} characters`,
	)
	.max(1024);

const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Expected base64');

/** The file an admin downloads from export and uploads to import. */
export const signingKeyExportSchema = z.object({
	format: z.literal(KEY_EXPORT_FORMAT),
	formatVersion: z.literal(KEY_EXPORT_FORMAT_VERSION),
	// Metadata. Import targets an explicit app; these are informational but
	// authenticated (part of the GCM additional data).
	appIdentifier: z.string().max(256),
	kid: z.string().max(64),
	algorithm: z.literal('RS256'),
	status: z.enum(['ACTIVE', 'STANDBY', 'RETIRED']),
	createdAt: z.string().max(64),
	kdf: z.object({
		name: z.literal('scrypt'),
		N: z
			.number()
			.int()
			.min(MIN_SCRYPT_N)
			.max(MAX_SCRYPT_N)
			.refine((n) => (n & (n - 1)) === 0, 'N must be a power of two'),
		r: z.literal(EXPORT_SCRYPT_PARAMS.r),
		p: z.literal(EXPORT_SCRYPT_PARAMS.p),
		salt: base64.max(64),
	}),
	cipher: z.object({
		name: z.literal('aes-256-gcm'),
		iv: base64.max(64),
		tag: base64.max(64),
	}),
	// AES-256-GCM ciphertext of the PKCS#8 DER private key.
	ciphertext: base64.max(16384),
});

export type SigningKeyExport = z.infer<typeof signingKeyExportSchema>;

export type SigningKeyExportMetadata = Pick<
	SigningKeyExport,
	'appIdentifier' | 'kid' | 'algorithm' | 'status' | 'createdAt'
>;

/** Thrown for a wrong passphrase, a tampered file, or malformed parameters. */
export class KeyExportDecryptionError extends Error {
	constructor() {
		super('Could not decrypt the key export');
		this.name = 'KeyExportDecryptionError';
	}
}

function deriveKey(
	passphrase: string,
	salt: Buffer,
	{ N, r, p }: { N: number; r: number; p: number },
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		// scrypt needs ~128 * N * r * p bytes; Node's 32 MiB default is too low.
		scryptCallback(
			passphrase,
			salt,
			KEY_BYTES,
			{ N, r, p, maxmem: 256 * N * r * p },
			(err, key) => (err ? reject(err) : resolve(key)),
		);
	});
}

/**
 * GCM additional data: everything in the file except the secret material and
 * the tag, in a fixed order, so editing any of it fails authentication.
 */
function additionalData(
	envelope: Omit<SigningKeyExport, 'ciphertext' | 'cipher'> & {
		cipher: { name: string; iv: string };
	},
): Buffer {
	return Buffer.from(
		JSON.stringify([
			envelope.format,
			envelope.formatVersion,
			envelope.appIdentifier,
			envelope.kid,
			envelope.algorithm,
			envelope.status,
			envelope.createdAt,
			envelope.kdf.name,
			envelope.kdf.N,
			envelope.kdf.r,
			envelope.kdf.p,
			envelope.kdf.salt,
			envelope.cipher.name,
			envelope.cipher.iv,
		]),
		'utf8',
	);
}

/** Encrypt a PKCS#8 DER private key into an export file. */
export async function sealSigningKey(
	pkcs8Der: Buffer,
	metadata: SigningKeyExportMetadata,
	passphrase: string,
): Promise<SigningKeyExport> {
	const salt = randomBytes(SALT_BYTES);
	const iv = randomBytes(IV_BYTES);
	const header = {
		format: KEY_EXPORT_FORMAT,
		formatVersion: KEY_EXPORT_FORMAT_VERSION,
		appIdentifier: metadata.appIdentifier,
		kid: metadata.kid,
		algorithm: metadata.algorithm,
		status: metadata.status,
		createdAt: metadata.createdAt,
		kdf: {
			name: 'scrypt' as const,
			...EXPORT_SCRYPT_PARAMS,
			salt: salt.toString('base64'),
		},
		cipher: { name: 'aes-256-gcm' as const, iv: iv.toString('base64') },
	};

	const key = await deriveKey(passphrase, salt, EXPORT_SCRYPT_PARAMS);
	const cipher = createCipheriv('aes-256-gcm', key, iv, {
		authTagLength: TAG_BYTES,
	});
	cipher.setAAD(additionalData(header));
	const ciphertext = Buffer.concat([cipher.update(pkcs8Der), cipher.final()]);

	return {
		...header,
		cipher: { ...header.cipher, tag: cipher.getAuthTag().toString('base64') },
		ciphertext: ciphertext.toString('base64'),
	};
}

/**
 * Decrypt an export file back to the PKCS#8 DER private key. Throws
 * KeyExportDecryptionError for a wrong passphrase or any tampering.
 */
export async function openSigningKey(
	envelope: SigningKeyExport,
	passphrase: string,
): Promise<Buffer> {
	const salt = Buffer.from(envelope.kdf.salt, 'base64');
	const iv = Buffer.from(envelope.cipher.iv, 'base64');
	const tag = Buffer.from(envelope.cipher.tag, 'base64');
	if (
		salt.length !== SALT_BYTES ||
		iv.length !== IV_BYTES ||
		tag.length !== TAG_BYTES
	) {
		throw new KeyExportDecryptionError();
	}

	const key = await deriveKey(passphrase, salt, envelope.kdf);
	try {
		const decipher = createDecipheriv('aes-256-gcm', key, iv, {
			authTagLength: TAG_BYTES,
		});
		decipher.setAAD(additionalData(envelope));
		decipher.setAuthTag(tag);
		return Buffer.concat([
			decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
			decipher.final(),
		]);
	} catch {
		throw new KeyExportDecryptionError();
	}
}
