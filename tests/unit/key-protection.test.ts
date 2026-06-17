import {
	loadPrivateKey,
	protectPrivateKey,
	resolveProtectionScheme,
	storePrivateKey,
	unprotectPrivateKey,
} from '@/lib/key-protection';

const PEM =
	'-----BEGIN PRIVATE KEY-----\nMIIBVgIBADANBgkqhkiG9w0BAQEFAASC\nfakekeymaterial==\n-----END PRIVATE KEY-----\n';

describe('local AES-GCM protection', () => {
	const cfg = { scheme: 'local', secret: 'a-dev-secret-value' } as const;

	it('round-trips a private key', async () => {
		const envelope = await protectPrivateKey(PEM, cfg);
		await expect(unprotectPrivateKey(envelope, cfg)).resolves.toBe(PEM);
	});

	it('produces a JSON envelope that does not leak the plaintext', async () => {
		const envelope = await protectPrivateKey(PEM, cfg);
		expect(envelope).not.toContain('BEGIN PRIVATE KEY');
		expect(envelope).not.toContain('fakekeymaterial');
		expect(JSON.parse(envelope).scheme).toBe('local');
	});

	it('rejects decryption with the wrong secret', async () => {
		const envelope = await protectPrivateKey(PEM, cfg);
		await expect(
			unprotectPrivateKey(envelope, {
				scheme: 'local',
				secret: 'wrong-secret',
			}),
		).rejects.toThrow();
	});

	it('rejects tampered ciphertext (GCM auth)', async () => {
		const env = JSON.parse(await protectPrivateKey(PEM, cfg));
		const buf = Buffer.from(env.ciphertext, 'base64');
		buf[0] ^= 0xff;
		env.ciphertext = buf.toString('base64');
		await expect(
			unprotectPrivateKey(JSON.stringify(env), cfg),
		).rejects.toThrow();
	});
});

describe('legacy plaintext migration', () => {
	it('passes an un-enveloped PEM through unchanged (re-encrypted on next write)', async () => {
		await expect(
			unprotectPrivateKey(PEM, { scheme: 'local', secret: 's' }),
		).resolves.toBe(PEM);
	});
});

describe('kms scheme dispatch (injected adapter)', () => {
	// Reversible fake KMS so we exercise dispatch without AWS.
	const kms = {
		encrypt: async (b: Buffer) => Buffer.concat([Buffer.from('ENC:'), b]),
		decrypt: async (b: Buffer) => b.subarray(4),
	};
	const cfg = { scheme: 'kms', keyId: 'alias/test', kms } as const;

	it('round-trips via the KMS adapter', async () => {
		const envelope = await protectPrivateKey(PEM, cfg);
		expect(JSON.parse(envelope).scheme).toBe('kms');
		await expect(unprotectPrivateKey(envelope, cfg)).resolves.toBe(PEM);
	});
});

describe('loadPrivateKey / storePrivateKey wrappers', () => {
	it('loads a legacy plaintext key WITHOUT requiring any protection config', async () => {
		// No SIGNING_KEY_SECRET / KMS in env — must still work for pre-encryption rows.
		await expect(loadPrivateKey(PEM, {})).resolves.toBe(PEM);
	});

	it('stores then loads via the local scheme from env', async () => {
		const env = { SIGNING_KEY_SECRET: 'env-dev-secret' };
		const stored = await storePrivateKey(PEM, env);
		expect(stored).not.toContain('BEGIN PRIVATE KEY');
		await expect(loadPrivateKey(stored, env)).resolves.toBe(PEM);
	});

	it('storePrivateKey throws when no protection is configured', async () => {
		await expect(storePrivateKey(PEM, {})).rejects.toThrow(/SIGNING_KEY/);
	});
});

describe('resolveProtectionScheme', () => {
	it('selects kms when SIGNING_KEY_KMS_KEY_ID is set', () => {
		const s = resolveProtectionScheme({ SIGNING_KEY_KMS_KEY_ID: 'alias/x' });
		expect(s).toEqual({ scheme: 'kms', keyId: 'alias/x' });
	});

	it('selects local when only SIGNING_KEY_SECRET is set', () => {
		const s = resolveProtectionScheme({ SIGNING_KEY_SECRET: 'shh' });
		expect(s).toEqual({ scheme: 'local', secret: 'shh' });
	});

	it('prefers kms when both are set', () => {
		const s = resolveProtectionScheme({
			SIGNING_KEY_KMS_KEY_ID: 'alias/x',
			SIGNING_KEY_SECRET: 'shh',
		});
		expect(s.scheme).toBe('kms');
	});

	it('throws when neither is configured (no insecure default)', () => {
		expect(() => resolveProtectionScheme({})).toThrow(/SIGNING_KEY/);
	});
});
