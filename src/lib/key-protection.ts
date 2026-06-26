/**
 * At-rest protection for signing private keys.
 *
 * Private keys are never persisted as plaintext PEM. They are stored as a JSON
 * envelope and decrypted in-process only when signing. Two schemes (bring your
 * own, like auth):
 *   - `kms`   — AWS KMS Encrypt/Decrypt (an RSA-2048 PKCS#8 PEM is < KMS's 4 KB
 *               plaintext limit, so no data-key envelope is needed).
 *   - `local` — AES-256-GCM with a key derived (scrypt) from SIGNING_KEY_SECRET;
 *               portable for self-hosters without KMS, and used in local dev.
 *
 * Legacy plaintext PEMs (pre-encryption rows) are read transparently and
 * re-encrypted on the next write.
 */

import 'server-only';
import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
} from 'crypto';

export type KmsAdapter = {
	encrypt(plaintext: Buffer): Promise<Buffer>;
	decrypt(ciphertext: Buffer): Promise<Buffer>;
};

export type ProtectionScheme =
	| { scheme: 'local'; secret: string }
	| { scheme: 'kms'; keyId: string };

export type ProtectionConfig =
	| { scheme: 'local'; secret: string }
	| { scheme: 'kms'; keyId: string; kms: KmsAdapter };

type Env = Record<string, string | undefined>;

const LOCAL_VERSION = 1;
const KMS_VERSION = 1;

function isLegacyPlaintext(stored: string): boolean {
	return stored.trimStart().startsWith('-----BEGIN');
}

function deriveLocalKey(secret: string, salt: Buffer): Buffer {
	return scryptSync(secret, salt, 32);
}

export function resolveProtectionScheme(
	env: Env = process.env,
): ProtectionScheme {
	if (env.SIGNING_KEY_KMS_KEY_ID) {
		return { scheme: 'kms', keyId: env.SIGNING_KEY_KMS_KEY_ID };
	}
	if (env.SIGNING_KEY_SECRET) {
		return { scheme: 'local', secret: env.SIGNING_KEY_SECRET };
	}
	throw new Error(
		'Signing-key protection is not configured: set SIGNING_KEY_KMS_KEY_ID (AWS KMS) or SIGNING_KEY_SECRET (local AES-GCM).',
	);
}

export async function protectPrivateKey(
	pem: string,
	config: ProtectionConfig,
): Promise<string> {
	if (config.scheme === 'local') {
		const salt = randomBytes(16);
		const iv = randomBytes(12);
		const key = deriveLocalKey(config.secret, salt);
		const cipher = createCipheriv('aes-256-gcm', key, iv);
		const ciphertext = Buffer.concat([
			cipher.update(pem, 'utf8'),
			cipher.final(),
		]);
		const tag = cipher.getAuthTag();
		return JSON.stringify({
			scheme: 'local',
			v: LOCAL_VERSION,
			salt: salt.toString('base64'),
			iv: iv.toString('base64'),
			tag: tag.toString('base64'),
			ciphertext: ciphertext.toString('base64'),
		});
	}

	const ciphertext = await config.kms.encrypt(Buffer.from(pem, 'utf8'));
	return JSON.stringify({
		scheme: 'kms',
		v: KMS_VERSION,
		keyId: config.keyId,
		ciphertext: ciphertext.toString('base64'),
	});
}

// A persisted key envelope. `scheme` is kept as a plain string (not a union) so
// the unknown-scheme guard below stays reachable for corrupt/forward data.
interface KeyEnvelope {
	scheme: string;
	salt?: string;
	iv?: string;
	tag?: string;
	ciphertext: string;
}

export async function unprotectPrivateKey(
	stored: string,
	config: ProtectionConfig,
): Promise<string> {
	// Legacy rows: plaintext PEM, not yet enveloped.
	if (isLegacyPlaintext(stored)) {
		return stored;
	}

	const envelope = JSON.parse(stored) as KeyEnvelope;

	if (envelope.scheme === 'local') {
		if (config.scheme !== 'local') {
			throw new Error(
				'Stored key uses the local scheme but no SIGNING_KEY_SECRET is configured.',
			);
		}
		const salt = Buffer.from(envelope.salt ?? '', 'base64');
		const iv = Buffer.from(envelope.iv ?? '', 'base64');
		const tag = Buffer.from(envelope.tag ?? '', 'base64');
		const key = deriveLocalKey(config.secret, salt);
		const decipher = createDecipheriv('aes-256-gcm', key, iv);
		decipher.setAuthTag(tag);
		const plaintext = Buffer.concat([
			decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
			decipher.final(),
		]);
		return plaintext.toString('utf8');
	}

	if (envelope.scheme === 'kms') {
		if (config.scheme !== 'kms') {
			throw new Error(
				'Stored key uses the KMS scheme but KMS is not configured.',
			);
		}
		const plaintext = await config.kms.decrypt(
			Buffer.from(envelope.ciphertext, 'base64'),
		);
		return plaintext.toString('utf8');
	}

	throw new Error(`Unknown key-protection scheme: ${envelope.scheme}`);
}

/**
 * Read a stored private key back to PEM. Legacy plaintext rows need no config
 * (so existing keys keep working); enveloped rows require the configured scheme.
 */
export async function loadPrivateKey(
	stored: string,
	env: Env = process.env,
): Promise<string> {
	if (isLegacyPlaintext(stored)) {
		return stored;
	}
	return unprotectPrivateKey(stored, await getProtectionConfig(env));
}

/** Encrypt a PEM for persistence using the configured scheme. */
export async function storePrivateKey(
	pem: string,
	env: Env = process.env,
): Promise<string> {
	return protectPrivateKey(pem, await getProtectionConfig(env));
}

/** Build the runtime protection config, constructing the real KMS adapter when needed. */
export async function getProtectionConfig(
	env: Env = process.env,
): Promise<ProtectionConfig> {
	const scheme = resolveProtectionScheme(env);
	if (scheme.scheme === 'local') {
		return scheme;
	}

	// Lazy-load the KMS SDK so non-KMS paths (and unit tests) never pull it in.
	const { KMSClient, EncryptCommand, DecryptCommand } =
		await import('@aws-sdk/client-kms');
	const client = new KMSClient({
		region: env.AWS_REGION ?? env.S3_REGION ?? 'us-east-1',
	});
	const kms: KmsAdapter = {
		async encrypt(plaintext) {
			const out = await client.send(
				new EncryptCommand({ KeyId: scheme.keyId, Plaintext: plaintext }),
			);
			return Buffer.from(out.CiphertextBlob!);
		},
		async decrypt(ciphertext) {
			const out = await client.send(
				new DecryptCommand({ CiphertextBlob: ciphertext }),
			);
			return Buffer.from(out.Plaintext!);
		},
	};
	return { scheme: 'kms', keyId: scheme.keyId, kms };
}
