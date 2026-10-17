import { createPublicKey, verify as nodeVerify } from 'crypto';
import { http, HttpResponse } from 'msw';
import { NextRequest } from 'next/server';
import {
	DELETE as deleteAppRoute,
	PUT as updateAppRoute,
} from '@/app/api/apps/[id]/route';
import { GET as getBootstrapJson } from '@/app/api/bootstrap/json/route';
import { GET as getBootstrapPlist } from '@/app/api/bootstrap/plist/route';
import {
	DELETE as deleteKeyRoute,
	PUT as updateKeyRoute,
} from '@/app/api/keys/[id]/route';
import { POST as exportKeyRoute } from '@/app/api/keys/export/route';
import { POST as importKeyRoute } from '@/app/api/keys/import/route';
import {
	POST as createKeyRoute,
	PUT as rotateKeyRoute,
} from '@/app/api/keys/route';
import { prisma } from '@/lib/db';
import { ensureSigningKey, signConfigDetached } from '@/lib/jws-signer';
import type { SigningKeyExport } from '@/lib/signing-keys';
import { server } from '../msw/server';

// Proxy auth: the role comes from the access list by the x-forwarded-email
// header. Key protection uses a throwaway local secret unless one is set.
const ADMIN = 'admin@example.com';
const DEV = 'dev@example.com';
const PASSPHRASE = 'correct horse battery staple';
const savedEnv = { ...process.env };

beforeAll(() => {
	process.env.AUTH_MODE = 'proxy';
	delete process.env.AUTH_PROXY_JWKS_URL;
	process.env.SIGNING_KEY_SECRET ??= 'integration-test-signing-secret';
	// Lazily imported apps route builds its S3 client from these (msw-mocked).
	process.env.S3_ENDPOINT = 'http://s3.test';
	process.env.S3_BUCKET = 'bunting-test';
	process.env.S3_REGION = 'us-east-1';
	process.env.S3_ACCESS_KEY_ID = 'test';
	process.env.S3_SECRET_ACCESS_KEY = 'test';
	process.env.CDN_BASE_URL = 'https://cdn.example.com';
});

afterAll(() => {
	process.env = savedEnv;
});

beforeEach(async () => {
	// A non-empty access list also stops the first-proxy-user ADMIN bootstrap.
	await prisma.accessList.createMany({
		data: [
			{ type: 'EMAIL', value: ADMIN, role: 'ADMIN' },
			{ type: 'EMAIL', value: DEV, role: 'DEVELOPER' },
		],
	});
});

function req(
	path: string,
	{
		method = 'GET',
		as = ADMIN,
		body,
	}: { method?: string; as?: string; body?: unknown } = {},
): NextRequest {
	return new NextRequest(`http://local${path}`, {
		method,
		headers: { 'content-type': 'application/json', 'x-forwarded-email': as },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function createApp(identifier: string) {
	return prisma.app.create({
		data: {
			name: `App ${identifier}`,
			identifier,
			artifactUrl: `https://cdn.example.com/${identifier}/config.json`,
			publicKeys: [],
			fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
			storageConfig: {},
		},
	});
}

async function keysByStatus(appId: string) {
	const keys = await prisma.signingKey.findMany({
		where: { appId },
		select: { kid: true, status: true, publicKey: true },
	});
	return {
		active: keys.filter((k) => k.status === 'ACTIVE'),
		standby: keys.filter((k) => k.status === 'STANDBY'),
		retired: keys.filter((k) => k.status === 'RETIRED'),
	};
}

function setStatus(appId: string, kid: string, status: string, as = ADMIN) {
	return updateKeyRoute(
		req(`/api/keys/${kid}?appId=${appId}`, {
			method: 'PUT',
			as,
			body: { status },
		}),
		params(kid),
	);
}

/** Verify a detached JWS (b64:false) over `payload` with a PEM public key. */
function verifyDetached(signature: string, payload: string, pem: string) {
	const [header, , sig] = signature.split('.');
	return nodeVerify(
		'RSA-SHA256',
		Buffer.concat([
			Buffer.from(header, 'utf8'),
			Buffer.from('.', 'utf8'),
			Buffer.from(payload, 'utf8'),
		]),
		createPublicKey(pem),
		Buffer.from(sig, 'base64url'),
	);
}

describe('app creation and ensureSigningKey', () => {
	test('POST /api/apps mints an ACTIVE and a STANDBY key and signs the initial config with the ACTIVE one', async () => {
		const uploads: Record<string, string> = {};
		server.use(
			http.put('http://s3.test/*', async ({ request }) => {
				uploads[new URL(request.url).pathname] = await request.text();
				return new HttpResponse(null, {
					status: 200,
					headers: { ETag: '"etag"' },
				});
			}),
		);
		const { POST } = await import('@/app/api/apps/route');

		const res = await POST(
			req('/api/apps', {
				method: 'POST',
				body: {
					name: 'Created',
					identifier: 'created-app',
					// Ignored: clients can no longer supply keys.
					publicKeys: [{ kid: 'default', pem: '[Your public key here]' }],
					fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
				},
			}),
		);
		expect(res.status).toBe(201);
		const app = (await res.json()) as { id: string; publicKeys: unknown };
		expect(app.publicKeys).toEqual([]);

		const { active, standby, retired } = await keysByStatus(app.id);
		expect(active).toHaveLength(1);
		expect(standby).toHaveLength(1);
		expect(retired).toHaveLength(0);

		const config = uploads['/bunting-test/created-app/config.json'];
		const signature = uploads['/bunting-test/created-app/config.json.sig'];
		expect(verifyDetached(signature, config, active[0].publicKey)).toBe(true);
		expect(verifyDetached(signature, config, standby[0].publicKey)).toBe(false);
	});

	test('a failed initial publish rolls back the app and its freshly minted keys', async () => {
		server.use(
			http.put(
				'http://s3.test/*',
				() =>
					new HttpResponse(
						'<Error><Code>AccessDenied</Code><Message>denied</Message></Error>',
						{ status: 403, headers: { 'Content-Type': 'application/xml' } },
					),
			),
		);
		const { POST } = await import('@/app/api/apps/route');

		const res = await POST(
			req('/api/apps', {
				method: 'POST',
				body: {
					name: 'Rollback',
					identifier: 'rollback-app',
					fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
				},
			}),
		);
		expect(res.status).toBe(500);
		expect(
			await prisma.app.findUnique({ where: { identifier: 'rollback-app' } }),
		).toBeNull();
		expect(await prisma.signingKey.count()).toBe(0);
	});

	test('promotes the oldest STANDBY key instead of minting when no key is ACTIVE', async () => {
		const app = await createApp('promote-app');
		const pem = '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----';
		await prisma.signingKey.createMany({
			data: [
				{
					appId: app.id,
					kid: 'a'.repeat(32),
					privateKey: 'x',
					publicKey: pem,
					status: 'STANDBY',
					createdAt: new Date('2026-01-02T00:00:00Z'),
				},
				{
					appId: app.id,
					kid: 'b'.repeat(32),
					privateKey: 'x',
					publicKey: pem,
					status: 'STANDBY',
					createdAt: new Date('2026-01-01T00:00:00Z'),
				},
				{
					appId: app.id,
					kid: 'c'.repeat(32),
					privateKey: 'x',
					publicKey: pem,
					status: 'RETIRED',
					createdAt: new Date('2025-01-01T00:00:00Z'),
				},
			],
		});

		await ensureSigningKey(app.id);

		const { active, standby, retired } = await keysByStatus(app.id);
		expect(active.map((k) => k.kid)).toEqual(['b'.repeat(32)]);
		expect(standby.map((k) => k.kid)).toEqual(['a'.repeat(32)]);
		expect(retired.map((k) => k.kid)).toEqual(['c'.repeat(32)]);
	});

	test('never re-activates a RETIRED key: an app with only retired keys gets a fresh pair', async () => {
		const app = await createApp('retired-only-app');
		await prisma.signingKey.create({
			data: {
				appId: app.id,
				kid: 'd'.repeat(32),
				privateKey: 'x',
				publicKey: 'pem',
				status: 'RETIRED',
			},
		});

		await ensureSigningKey(app.id);

		const { active, standby, retired } = await keysByStatus(app.id);
		expect(active).toHaveLength(1);
		expect(standby).toHaveLength(1);
		expect(retired.map((k) => k.kid)).toEqual(['d'.repeat(32)]);
	});

	test('concurrent ensureSigningKey calls leave exactly one ACTIVE key', async () => {
		const app = await createApp('race-app');
		await Promise.all([
			ensureSigningKey(app.id),
			ensureSigningKey(app.id),
			ensureSigningKey(app.id),
		]);
		const { active, standby } = await keysByStatus(app.id);
		expect(active).toHaveLength(1);
		expect(standby).toHaveLength(1);
	});
});

describe('bootstrap files', () => {
	test('plist and json list every non-RETIRED key, ACTIVE first, and exclude RETIRED keys', async () => {
		const app = await createApp('bootstrap-app');
		await ensureSigningKey(app.id);
		const created = await createKeyRoute(
			req('/api/keys', { method: 'POST', body: { appId: app.id } }),
		);
		expect(created.status).toBe(201);
		const { kid: retiredKid } = (await created.json()) as { kid: string };
		expect((await setStatus(app.id, retiredKid, 'RETIRED')).status).toBe(200);

		// Rotate so the ACTIVE key is not simply the oldest row.
		const before = await keysByStatus(app.id);
		const oldActive = before.active[0].kid;
		const newActive = before.standby[0].kid;
		expect((await setStatus(app.id, newActive, 'ACTIVE')).status).toBe(200);

		const jsonRes = await getBootstrapJson(
			req(`/api/bootstrap/json?appId=${app.id}`),
		);
		expect(jsonRes.status).toBe(200);
		const doc = (await jsonRes.json()) as {
			public_keys: Array<{ kid: string; pem: string }>;
		};
		expect(doc.public_keys.map((k) => k.kid)).toEqual([newActive, oldActive]);

		const plistRes = await getBootstrapPlist(
			req(`/api/bootstrap/plist?appIdentifier=${app.identifier}`),
		);
		expect(plistRes.status).toBe(200);
		const plist = await plistRes.text();
		const kids = [...plist.matchAll(/<key>kid<\/key>\s*<string>([^<]+)</g)].map(
			(m) => m[1],
		);
		expect(kids).toEqual([newActive, oldActive]);
		expect(plist).not.toContain(retiredKid);
	});

	test('an app with no keys gets a minted ACTIVE + STANDBY pair, never the legacy placeholder', async () => {
		const app = await prisma.app.create({
			data: {
				name: 'Legacy',
				identifier: 'legacy-placeholder-app',
				artifactUrl:
					'https://cdn.example.com/legacy-placeholder-app/config.json',
				// What the setup wizard used to write.
				publicKeys: [
					{
						kid: 'default',
						pem: '-----BEGIN PUBLIC KEY-----\n[Your public key here]\n-----END PUBLIC KEY-----',
					},
				],
				fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
				storageConfig: {},
			},
		});

		const plistRes = await getBootstrapPlist(
			req(`/api/bootstrap/plist?appId=${app.id}`),
		);
		expect(plistRes.status).toBe(200);
		const plist = await plistRes.text();
		expect(plist).not.toContain('[Your public key here]');
		expect(plist).not.toContain('<string>default</string>');

		const { active, standby } = await keysByStatus(app.id);
		expect(active).toHaveLength(1);
		expect(standby).toHaveLength(1);

		const jsonRes = await getBootstrapJson(
			req(`/api/bootstrap/json?appId=${app.id}`),
		);
		const doc = (await jsonRes.json()) as {
			public_keys: Array<{ kid: string }>;
		};
		expect(doc.public_keys.map((k) => k.kid)).toEqual([
			active[0].kid,
			standby[0].kid,
		]);
	});
});

describe('key lifecycle transitions', () => {
	test('activate swaps ACTIVE to STANDBY atomically; retire and delete follow the rules', async () => {
		const app = await createApp('lifecycle-app');
		await ensureSigningKey(app.id);
		const initial = await keysByStatus(app.id);
		const a = initial.active[0].kid;
		const s = initial.standby[0].kid;

		// Activate the standby: the old active key drops to STANDBY, still trusted.
		expect((await setStatus(app.id, s, 'ACTIVE')).status).toBe(200);
		let keys = await keysByStatus(app.id);
		expect(keys.active.map((k) => k.kid)).toEqual([s]);
		expect(keys.standby.map((k) => k.kid)).toEqual([a]);
		expect((await signConfigDetached(app.id, '{}')).keyId).toBe(s);

		// The ACTIVE key can't be retired or deleted.
		expect((await setStatus(app.id, s, 'RETIRED')).status).toBe(409);
		const deleteActive = await deleteKeyRoute(
			req(`/api/keys/${s}?appId=${app.id}`, { method: 'DELETE' }),
			params(s),
		);
		expect(deleteActive.status).toBe(409);

		// STANDBY is never set directly.
		expect((await setStatus(app.id, a, 'STANDBY')).status).toBe(400);

		// A STANDBY key can't be deleted until retired.
		const deleteStandby = await deleteKeyRoute(
			req(`/api/keys/${a}?appId=${app.id}`, { method: 'DELETE' }),
			params(a),
		);
		expect(deleteStandby.status).toBe(409);

		// Retire the standby; it can never come back.
		expect((await setStatus(app.id, a, 'RETIRED')).status).toBe(200);
		expect((await setStatus(app.id, a, 'ACTIVE')).status).toBe(409);
		const rotateToRetired = await rotateKeyRoute(
			req('/api/keys', {
				method: 'PUT',
				body: { appId: app.id, newKeyId: a },
			}),
		);
		expect(rotateToRetired.status).toBe(409);

		// Only now can it be deleted.
		const deleteRetired = await deleteKeyRoute(
			req(`/api/keys/${a}?appId=${app.id}`, { method: 'DELETE' }),
			params(a),
		);
		expect(deleteRetired.status).toBe(200);
		keys = await keysByStatus(app.id);
		expect(keys.active.map((k) => k.kid)).toEqual([s]);
		expect(keys.standby).toHaveLength(0);
		expect(keys.retired).toHaveLength(0);

		// New keys always start as STANDBY; PUT /api/keys rotates to them.
		const created = await createKeyRoute(
			req('/api/keys', {
				method: 'POST',
				body: { appId: app.id, isActive: true },
			}),
		);
		const { kid: n, status } = (await created.json()) as {
			kid: string;
			status: string;
		};
		expect(status).toBe('STANDBY');
		const rotate = await rotateKeyRoute(
			req('/api/keys', {
				method: 'PUT',
				body: { appId: app.id, newKeyId: n },
			}),
		);
		expect(rotate.status).toBe(200);
		keys = await keysByStatus(app.id);
		expect(keys.active.map((k) => k.kid)).toEqual([n]);
		expect(keys.standby.map((k) => k.kid)).toEqual([s]);

		const actions = await prisma.activityLog.findMany({
			where: { appId: app.id, entityType: 'signing_key' },
			select: { action: true },
		});
		expect(actions.map((x) => x.action).sort()).toEqual(
			['activate', 'activate', 'create', 'delete', 'retire'].sort(),
		);
	});

	test('concurrent activations leave exactly one ACTIVE key', async () => {
		const app = await createApp('activate-race-app');
		await ensureSigningKey(app.id);
		const created = await createKeyRoute(
			req('/api/keys', { method: 'POST', body: { appId: app.id } }),
		);
		const { kid: extra } = (await created.json()) as { kid: string };
		const { standby } = await keysByStatus(app.id);
		expect(standby).toHaveLength(2);

		const results = await Promise.all(
			standby.map((k) => setStatus(app.id, k.kid, 'ACTIVE')),
		);
		expect(results.map((r) => r.status)).toEqual([200, 200]);
		const keys = await keysByStatus(app.id);
		expect(keys.active).toHaveLength(1);
		expect(keys.standby).toHaveLength(2);
		expect([...keys.active, ...keys.standby].map((k) => k.kid)).toContain(
			extra,
		);
	});
});

describe('export and import', () => {
	async function exportKey(kid: string, passphrase = PASSPHRASE, as = ADMIN) {
		return exportKeyRoute(
			req('/api/keys/export', {
				method: 'POST',
				as,
				body: { keyId: kid, passphrase },
			}),
		);
	}

	async function importKey(
		appId: string,
		envelope: unknown,
		passphrase = PASSPHRASE,
		as = ADMIN,
	) {
		return importKeyRoute(
			req('/api/keys/import', {
				method: 'POST',
				as,
				body: { appId, envelope, passphrase },
			}),
		);
	}

	test('round-trips a key into another app with its kid preserved; it signs and verifies', async () => {
		const source = await createApp('export-source');
		const target = await createApp('import-target');
		await ensureSigningKey(source.id);
		await ensureSigningKey(target.id);
		const { standby } = await keysByStatus(source.id);
		const { kid, publicKey } = standby[0];

		const exported = await exportKey(kid);
		expect(exported.status).toBe(200);
		expect(exported.headers.get('content-disposition')).toBe(
			`attachment; filename="bunting-key-export-source-${kid}.json"`,
		);
		expect(exported.headers.get('cache-control')).toBe('no-store');
		const envelope = (await exported.json()) as SigningKeyExport;
		expect(envelope).toMatchObject({
			format: 'bunting-signing-key',
			formatVersion: 1,
			appIdentifier: 'export-source',
			kid,
			algorithm: 'RS256',
			status: 'STANDBY',
		});
		expect(envelope.privateKeyPem).toMatch(
			/^-----BEGIN ENCRYPTED PRIVATE KEY-----/,
		);
		expect(JSON.stringify(envelope)).not.toContain('BEGIN PRIVATE KEY');

		// kids are unique per instance: importing while the original exists fails.
		const duplicate = await importKey(target.id, envelope);
		expect(duplicate.status).toBe(409);

		// Move the key: retire and delete it in the source app.
		expect((await setStatus(source.id, kid, 'RETIRED')).status).toBe(200);
		const deleted = await deleteKeyRoute(
			req(`/api/keys/${kid}?appId=${source.id}`, { method: 'DELETE' }),
			params(kid),
		);
		expect(deleted.status).toBe(200);

		const wrong = await importKey(
			target.id,
			envelope,
			'not the right passphrase',
		);
		expect(wrong.status).toBe(400);
		expect(await prisma.signingKey.findUnique({ where: { kid } })).toBeNull();

		const imported = await importKey(target.id, envelope);
		expect(imported.status).toBe(201);
		expect(await imported.json()).toMatchObject({ kid, status: 'STANDBY' });

		const row = await prisma.signingKey.findUnique({ where: { kid } });
		expect(row?.appId).toBe(target.id);
		expect(row?.status).toBe('STANDBY');
		expect(row?.publicKey.trim()).toBe(publicKey.trim());
		// Stored encrypted at rest, like generated keys.
		expect(row?.privateKey).not.toContain('PRIVATE KEY');

		// Activate it in the target and sign: the source app's public key verifies.
		expect((await setStatus(target.id, kid, 'ACTIVE')).status).toBe(200);
		const payload = '{"hello":"world"}';
		const signed = await signConfigDetached(target.id, payload);
		expect(signed.keyId).toBe(kid);
		expect(verifyDetached(signed.signature, payload, publicKey)).toBe(true);

		const logs = await prisma.activityLog.findMany({
			where: {
				appId: { in: [source.id, target.id] },
				entityType: 'signing_key',
				action: { in: ['export', 'import'] },
			},
		});
		expect(logs.map((l) => l.action).sort()).toEqual(['export', 'import']);
		const logged = JSON.stringify(
			await prisma.activityLog.findMany({
				where: { entityType: 'signing_key' },
			}),
		);
		expect(logged).not.toContain('PRIVATE KEY');
		expect(logged).not.toContain(PASSPHRASE);
	});

	test('rejects short passphrases, tampered envelopes and missing keys', async () => {
		const app = await createApp('export-validation');
		await ensureSigningKey(app.id);
		const { active } = await keysByStatus(app.id);
		const kid = active[0].kid;

		expect((await exportKey(kid, 'too-short')).status).toBe(400);
		expect((await exportKey('f'.repeat(32))).status).toBe(404);

		const envelope = (await (await exportKey(kid)).json()) as SigningKeyExport;
		const other = await createApp('import-validation');

		const badKid = await importKey(other.id, {
			...envelope,
			kid: 'not-a-kid',
		});
		expect(badKid.status).toBe(400);

		const plaintext = await importKey(other.id, {
			...envelope,
			privateKeyPem:
				'-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----',
		});
		expect(plaintext.status).toBe(400);

		const wrongFormat = await importKey(other.id, {
			...envelope,
			format: 'something-else',
		});
		expect(wrongFormat.status).toBe(400);

		const noApp = await importKey('missing-app', envelope);
		expect(noApp.status).toBe(404);

		// Same key material under a different (valid) kid is still a duplicate.
		const renamed = await importKey(other.id, {
			...envelope,
			kid: '0'.repeat(32),
		});
		expect(renamed.status).toBe(409);
		expect(await prisma.signingKey.count({ where: { appId: other.id } })).toBe(
			0,
		);
	});
});

describe('admin-only routes', () => {
	test('a DEVELOPER gets 403 on export, import, app update and app delete', async () => {
		const app = await createApp('authz-app');
		await ensureSigningKey(app.id);
		const { active } = await keysByStatus(app.id);

		const exportRes = await exportKeyRoute(
			req('/api/keys/export', {
				method: 'POST',
				as: DEV,
				body: { keyId: active[0].kid, passphrase: PASSPHRASE },
			}),
		);
		expect(exportRes.status).toBe(403);

		const importRes = await importKeyRoute(
			req('/api/keys/import', {
				method: 'POST',
				as: DEV,
				body: { appId: app.id, envelope: {}, passphrase: PASSPHRASE },
			}),
		);
		expect(importRes.status).toBe(403);

		const updateRes = await updateAppRoute(
			req(`/api/apps/${app.id}`, {
				method: 'PUT',
				as: DEV,
				body: { name: 'Renamed' },
			}),
			params(app.id),
		);
		expect(updateRes.status).toBe(403);

		const deleteRes = await deleteAppRoute(
			req(`/api/apps/${app.id}`, {
				method: 'DELETE',
				as: DEV,
				body: { confirmIdentifier: app.identifier, deleteSigningKeys: true },
			}),
			params(app.id),
		);
		expect(deleteRes.status).toBe(403);

		const unchanged = await prisma.app.findUnique({ where: { id: app.id } });
		expect(unchanged?.name).toBe(app.name);
		expect(await prisma.signingKey.count({ where: { appId: app.id } })).toBe(2);
	});
});

describe('app update and delete', () => {
	test('identifier is immutable: a change returns 409, name and fetch policy still update', async () => {
		const app = await createApp('immutable-app');

		const change = await updateAppRoute(
			req(`/api/apps/${app.id}`, {
				method: 'PUT',
				body: { identifier: 'moved-app' },
			}),
			params(app.id),
		);
		expect(change.status).toBe(409);

		const ok = await updateAppRoute(
			req(`/api/apps/${app.id}`, {
				method: 'PUT',
				body: {
					name: 'Renamed',
					identifier: 'immutable-app',
					fetchPolicy: { min_interval_seconds: 120, hard_ttl_days: 3 },
					// No longer accepted; silently ignored.
					publicKeys: [{ kid: 'x', pem: 'y' }],
				},
			}),
			params(app.id),
		);
		expect(ok.status).toBe(200);

		const row = await prisma.app.findUnique({ where: { id: app.id } });
		expect(row?.identifier).toBe('immutable-app');
		expect(row?.artifactUrl).toBe(app.artifactUrl);
		expect(row?.name).toBe('Renamed');
		expect(row?.fetchPolicy).toEqual({
			min_interval_seconds: 120,
			hard_ttl_days: 3,
		});
		expect(row?.publicKeys).toEqual([]);
	});

	test('delete needs the typed identifier and refuses while keys exist unless key deletion is confirmed', async () => {
		const app = await createApp('delete-app');
		await ensureSigningKey(app.id);
		const kids = (
			await prisma.signingKey.findMany({ where: { appId: app.id } })
		).map((k) => k.kid);

		const del = (body: unknown) =>
			deleteAppRoute(
				req(`/api/apps/${app.id}`, { method: 'DELETE', body }),
				params(app.id),
			);

		expect((await del({})).status).toBe(400);
		expect((await del({ confirmIdentifier: 'wrong' })).status).toBe(400);

		const refused = await del({ confirmIdentifier: 'delete-app' });
		expect(refused.status).toBe(409);
		expect(await refused.json()).toMatchObject({ signingKeyCount: 2 });
		expect(
			await prisma.app.findUnique({ where: { id: app.id } }),
		).not.toBeNull();
		expect(await prisma.signingKey.count({ where: { appId: app.id } })).toBe(2);

		// The FK no longer cascades: a raw app delete can't take the keys with it.
		await expect(
			prisma.app.delete({ where: { id: app.id } }),
		).rejects.toThrow();

		const deleted = await del({
			confirmIdentifier: 'delete-app',
			deleteSigningKeys: true,
		});
		expect(deleted.status).toBe(200);
		expect(await prisma.app.findUnique({ where: { id: app.id } })).toBeNull();
		expect(await prisma.signingKey.count({ where: { appId: app.id } })).toBe(0);

		const keyDeletes = await prisma.activityLog.findMany({
			where: { appId: app.id, entityType: 'signing_key', action: 'delete' },
		});
		expect(keyDeletes).toHaveLength(2);
		expect(
			kids.every((kid) => keyDeletes.some((l) => l.summary?.includes(kid))),
		).toBe(true);
	});

	test('an app without keys deletes with just the typed identifier', async () => {
		const app = await createApp('keyless-app');
		const res = await deleteAppRoute(
			req(`/api/apps/${app.id}`, {
				method: 'DELETE',
				body: { confirmIdentifier: 'keyless-app' },
			}),
			params(app.id),
		);
		expect(res.status).toBe(200);
		expect(await prisma.app.findUnique({ where: { id: app.id } })).toBeNull();
	});
});
