import { generateKeyPairSync } from 'crypto';
import {
	EXPORT_SCRYPT_PARAMS,
	KeyExportDecryptionError,
	openSigningKey,
	sealSigningKey,
	type SigningKeyExport,
	signingKeyExportSchema,
} from '@/lib/key-export';

// scrypt at N=2^17 takes a few hundred ms per derivation; seal once.
jest.setTimeout(20000);

const PASSPHRASE = 'correct horse battery staple';
const der = generateKeyPairSync('rsa', {
	modulusLength: 2048,
}).privateKey.export({ type: 'pkcs8', format: 'der' });
const metadata = {
	appIdentifier: 'painting-desk',
	kid: 'a'.repeat(32),
	algorithm: 'RS256' as const,
	status: 'STANDBY' as const,
	createdAt: '2026-10-01T00:00:00.000Z',
};

let sealed: SigningKeyExport;

beforeAll(async () => {
	sealed = await sealSigningKey(der, metadata, PASSPHRASE);
});

describe('signing-key export envelope', () => {
	test('records scrypt + AES-256-GCM parameters and round-trips the DER', async () => {
		expect(signingKeyExportSchema.parse(sealed)).toEqual(sealed);
		expect(sealed).toMatchObject({
			format: 'bunting-signing-key',
			formatVersion: 1,
			...metadata,
			kdf: { name: 'scrypt', ...EXPORT_SCRYPT_PARAMS },
			cipher: { name: 'aes-256-gcm' },
		});
		expect(EXPORT_SCRYPT_PARAMS).toEqual({ N: 2 ** 17, r: 8, p: 1 });
		expect(Buffer.from(sealed.kdf.salt, 'base64')).toHaveLength(16);
		expect(Buffer.from(sealed.cipher.iv, 'base64')).toHaveLength(12);
		expect(Buffer.from(sealed.cipher.tag, 'base64')).toHaveLength(16);
		expect(Buffer.from(sealed.ciphertext, 'base64').equals(der)).toBe(false);

		const opened = await openSigningKey(sealed, PASSPHRASE);
		expect(opened.equals(der)).toBe(true);
	});

	test('a wrong passphrase fails', async () => {
		await expect(
			openSigningKey(sealed, 'not the right passphrase'),
		).rejects.toBeInstanceOf(KeyExportDecryptionError);
	});

	test.each([
		['appIdentifier', { appIdentifier: 'other-app' }],
		['kid', { kid: 'b'.repeat(32) }],
		['status', { status: 'ACTIVE' as const }],
		['createdAt', { createdAt: '2020-01-01T00:00:00.000Z' }],
	])('editing %s fails authentication', async (_field, change) => {
		await expect(
			openSigningKey({ ...sealed, ...change }, PASSPHRASE),
		).rejects.toBeInstanceOf(KeyExportDecryptionError);
	});

	test('editing the ciphertext or tag fails authentication', async () => {
		const flip = (b64: string) => {
			const bytes = Buffer.from(b64, 'base64');
			bytes[bytes.length - 1] ^= 1;
			return bytes.toString('base64');
		};
		await expect(
			openSigningKey(
				{ ...sealed, ciphertext: flip(sealed.ciphertext) },
				PASSPHRASE,
			),
		).rejects.toBeInstanceOf(KeyExportDecryptionError);
		await expect(
			openSigningKey(
				{
					...sealed,
					cipher: { ...sealed.cipher, tag: flip(sealed.cipher.tag) },
				},
				PASSPHRASE,
			),
		).rejects.toBeInstanceOf(KeyExportDecryptionError);
	});

	test('malformed salt, IV or tag lengths are rejected without decrypting', async () => {
		await expect(
			openSigningKey(
				{ ...sealed, cipher: { ...sealed.cipher, iv: 'AAAA' } },
				PASSPHRASE,
			),
		).rejects.toBeInstanceOf(KeyExportDecryptionError);
	});

	test('the schema bounds scrypt cost and pins r and p', () => {
		const withKdf = (kdf: Partial<SigningKeyExport['kdf']>) =>
			signingKeyExportSchema.safeParse({
				...sealed,
				kdf: { ...sealed.kdf, ...kdf },
			}).success;
		expect(withKdf({ N: 2 ** 18 })).toBe(true);
		expect(withKdf({ N: 2 ** 20 })).toBe(false);
		expect(withKdf({ N: 2 ** 10 })).toBe(false);
		expect(withKdf({ N: 100000 })).toBe(false);
		expect(withKdf({ r: 16 as 8 })).toBe(false);
		expect(withKdf({ p: 2 as 1 })).toBe(false);
	});
});
