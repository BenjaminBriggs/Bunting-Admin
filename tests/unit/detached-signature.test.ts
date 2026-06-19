import {
	createPublicKey,
	generateKeyPairSync,
	verify as nodeVerify,
} from 'crypto';
import { importPKCS8 } from 'jose';
import { signDetached } from '@/lib/detached-signature';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
	modulusLength: 2048,
	publicKeyEncoding: { type: 'spki', format: 'pem' },
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Mirror exactly what the Swift SDK does: signing input is
// `BASE64URL(header) + "." + <fetched config bytes>`, verified raw RSA-PKCS1-SHA256.
function sdkVerify(jws: string, configBytes: string, pubPem: string): boolean {
	const parts = jws.split('.'); // ['<protected>', '', '<signature>']
	if (parts.length !== 3) {
		return false;
	}
	const signingInput = Buffer.concat([
		Buffer.from(parts[0], 'utf8'),
		Buffer.from('.', 'utf8'),
		Buffer.from(configBytes, 'utf8'),
	]);
	const sig = Buffer.from(parts[2], 'base64url');
	return nodeVerify('RSA-SHA256', signingInput, createPublicKey(pubPem), sig);
}

describe('signDetached', () => {
	const config = JSON.stringify(
		{ schema_version: 1, flags: { a: { type: 'bool' } } },
		null,
		2,
	);
	let key: CryptoKey;

	beforeAll(async () => {
		key = await importPKCS8(privateKey, 'RS256');
	});

	it('produces a compact detached JWS (header..signature, empty payload segment)', async () => {
		const jws = await signDetached(config, key, { alg: 'RS256', kid: 'k1' });
		const parts = jws.split('.');
		expect(parts).toHaveLength(3);
		expect(parts[1]).toBe(''); // detached: payload not embedded
		const header = JSON.parse(
			Buffer.from(parts[0], 'base64url').toString('utf8'),
		) as Record<string, unknown>;
		expect(header).toMatchObject({
			alg: 'RS256',
			kid: 'k1',
			b64: false,
			crit: ['b64'],
		});
	});

	it('verifies against the exact signed bytes (SDK reconstruction)', async () => {
		const jws = await signDetached(config, key, { alg: 'RS256', kid: 'k1' });
		expect(sdkVerify(jws, config, publicKey)).toBe(true);
	});

	it('fails verification if a single byte of the config changes', async () => {
		const jws = await signDetached(config, key, { alg: 'RS256', kid: 'k1' });
		expect(sdkVerify(jws, config + ' ', publicKey)).toBe(false);
		expect(sdkVerify(jws, config.replace('bool', 'int'), publicKey)).toBe(
			false,
		);
	});
});
