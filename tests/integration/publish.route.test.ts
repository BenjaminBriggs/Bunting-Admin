import { createPublicKey, verify as nodeVerify } from 'crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { http, passthrough } from 'msw';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/config/publish/route';
import { prisma } from '@/lib/db';
import { getConfigBucket, getS3Client } from '@/lib/storage';
import { server } from '../msw/server';

// Needs real MinIO + signing env. Skipped where S3 isn't configured (e.g. CI
// without MinIO). Run locally with:
//   DATABASE_URL=... S3_ENDPOINT=http://localhost:9000 S3_ACCESS_KEY_ID=admin \
//   S3_SECRET_ACCESS_KEY=admin123 S3_BUCKET=bunting-configs S3_REGION=us-east-1 \
//   SIGNING_KEY_SECRET=dev AUTH_MODE=proxy pnpm exec jest tests/integration/publish.route.test.ts
const hasSigningEnv =
	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- intentional: an empty-string env var means "not configured", so '' must fall through to the second operand
	process.env.SIGNING_KEY_SECRET || process.env.SIGNING_KEY_KMS_KEY_ID;
const run = process.env.S3_ENDPOINT && hasSigningEnv ? describe : describe.skip;

async function s3Text(key: string): Promise<string> {
	const res = await getS3Client().send(
		new GetObjectCommand({ Bucket: getConfigBucket(), Key: key }),
	);
	return res.Body!.transformToString();
}

run('POST /api/config/publish (integration)', () => {
	// Let real MinIO traffic through msw. Must be beforeEach: the integration
	// setup's afterEach calls server.resetHandlers(), which would otherwise drop
	// this passthrough after the first test.
	beforeEach(async () => {
		const endpoint = process.env.S3_ENDPOINT!;
		server.use(http.all(`${endpoint}/*`, () => passthrough()));
		// Publishing now requires ADMIN. In proxy mode the role is resolved from
		// the access list, so authorize the test publishers there.
		for (const email of ['publisher@example.com', 'p@example.com']) {
			await prisma.accessList.upsert({
				where: { type_value: { type: 'EMAIL', value: email } },
				update: { role: 'ADMIN' },
				create: { type: 'EMAIL', value: email, role: 'ADMIN' },
			});
		}
	});

	test('signs the exact uploaded bytes, allocates a version, and records the publisher', async () => {
		const identifier = `pub-${Date.now()}`;
		const app = await prisma.app.create({
			data: {
				name: 'Publish Test',
				identifier,
				artifactUrl: `http://localhost:9000/${process.env.S3_BUCKET}/${identifier}/`,
				publicKeys: [],
				fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
				storageConfig: {},
			},
		});
		await prisma.flag.create({
			data: {
				appId: app.id,
				key: 'feature_a',
				displayName: 'Feature A',
				type: 'BOOL',
				defaultValues: { development: true, beta: false, production: false },
			},
		});

		const req = new NextRequest('http://local/api/config/publish', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-forwarded-email': 'publisher@example.com',
			},
			body: JSON.stringify({ appId: app.id, changelog: 'first publish' }),
		});

		const res = await POST(req);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { signed: boolean; version: string };
		expect(json.signed).toBe(true);
		expect(json.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);

		// #7: publisher recorded from the (proxy) identity, not a hardcoded value.
		const audit = await prisma.auditLog.findFirst({ where: { appId: app.id } });
		expect(audit?.publishedBy).toBe('publisher@example.com');
		expect(audit?.configVersion).toBe(json.version);

		// #6: both objects are present.
		const configBytes = await s3Text(`${identifier}/config.json`);
		const sig = await s3Text(`${identifier}/config.json.sig`);
		expect(configBytes).toContain('"feature_a"');

		// #4: the detached signature verifies against the EXACT uploaded bytes.
		const key = await prisma.signingKey.findFirst({
			where: { appId: app.id, isActive: true },
		});
		const parts = sig.split('.');
		const signingInput = Buffer.concat([
			Buffer.from(parts[0], 'utf8'),
			Buffer.from('.', 'utf8'),
			Buffer.from(configBytes, 'utf8'),
		]);
		const ok = nodeVerify(
			'RSA-SHA256',
			signingInput,
			createPublicKey(key!.publicKey),
			Buffer.from(parts[2], 'base64url'),
		);
		expect(ok).toBe(true);

		// Tampering one byte must break verification.
		const bad = nodeVerify(
			'RSA-SHA256',
			Buffer.concat([
				Buffer.from(parts[0]),
				Buffer.from('.'),
				Buffer.from(configBytes + ' '),
			]),
			createPublicKey(key!.publicKey),
			Buffer.from(parts[2], 'base64url'),
		);
		expect(bad).toBe(false);
	});

	test('allocates monotonic versions across successive publishes (#5)', async () => {
		const identifier = `pub-seq-${Date.now()}`;
		const app = await prisma.app.create({
			data: {
				name: 'Seq',
				identifier,
				artifactUrl: `http://localhost:9000/${process.env.S3_BUCKET}/${identifier}/`,
				publicKeys: [],
				fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
				storageConfig: {},
			},
		});

		const publish = (): Promise<{ version: string }> => {
			const req = new NextRequest('http://local/api/config/publish', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-forwarded-email': 'p@example.com',
				},
				body: JSON.stringify({ appId: app.id, changelog: 'c' }),
			});
			return POST(req).then((r) => r.json() as Promise<{ version: string }>);
		};

		const first = await publish();
		const second = await publish();
		const seq = (v: string) => Number.parseInt(v.split('.')[1], 10);
		expect(seq(second.version)).toBe(seq(first.version) + 1);
	});

	// Regression for the live E2E finding: a json flag with a raw-object default
	// (not a JSON-encoded string) is exactly what /api/config/validate flags as
	// blocking, but /api/config/publish used to sign and upload it anyway —
	// bricking decode for every SDK client. Verify the rejection is real: no
	// version consumed, nothing uploaded, before any S3 interaction.
	test('rejects a json flag with a raw-object default before any version reservation or upload', async () => {
		const identifier = `pub-invalid-${Date.now()}`;
		const app = await prisma.app.create({
			data: {
				name: 'Invalid Publish Test',
				identifier,
				artifactUrl: `http://localhost:9000/${process.env.S3_BUCKET}/${identifier}/`,
				publicKeys: [],
				fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
				storageConfig: {},
			},
		});
		await prisma.flag.create({
			data: {
				appId: app.id,
				key: 'layout/home_sections',
				displayName: 'Home Sections',
				type: 'JSON',
				// Raw object, not a JSON-encoded string — the artifact spec violation
				// proven live against a real publish.
				defaultValues: {
					development: { sections: ['hero'] },
					beta: '{}',
					production: '{}',
				},
			},
		});

		const req = new NextRequest('http://local/api/config/publish', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-forwarded-email': 'publisher@example.com',
			},
			body: JSON.stringify({ appId: app.id, changelog: 'bad json default' }),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const json = (await res.json()) as { error: string; errors: unknown[] };
		expect(json.error).toMatch(/invalid/i);
		expect(json.errors.length).toBeGreaterThan(0);

		// No version was reserved.
		const audits = await prisma.auditLog.findMany({ where: { appId: app.id } });
		expect(audits).toHaveLength(0);

		// Nothing was uploaded to S3.
		await expect(s3Text(`${identifier}/config.json`)).rejects.toThrow();
		await expect(s3Text(`${identifier}/config.json.sig`)).rejects.toThrow();
	});
});
