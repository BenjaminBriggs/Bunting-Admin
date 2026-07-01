import { NextRequest } from 'next/server';
import { GET } from '@/app/api/bootstrap/plist/route';
import { prisma } from '@/lib/db';

describe('GET /api/bootstrap/plist', () => {
	test('emits the full config.json URL as endpoint_url, even for a legacy directory-shaped artifactUrl', async () => {
		const identifier = `plist-${Date.now()}`;
		const app = await prisma.app.create({
			data: {
				name: 'Plist Test',
				identifier,
				// Legacy shape written before the artifactUrlFor fix — a directory
				// URL with a trailing slash instead of the full config.json URL.
				artifactUrl: `https://cdn.example.com/${identifier}/`,
				publicKeys: [
					{
						kid: 'test-key-1',
						pem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtestkey\n-----END PUBLIC KEY-----',
					},
				],
				fetchPolicy: { min_interval_seconds: 60, hard_ttl_days: 7 },
				storageConfig: {},
			},
		});

		const req = new NextRequest(
			`http://local/api/bootstrap/plist?appId=${app.id}`,
		);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.text();
		expect(body).toContain(
			`<string>https://cdn.example.com/${identifier}/config.json</string>`,
		);
		expect(body).not.toContain(
			`<string>https://cdn.example.com/${identifier}/</string>`,
		);
	});
});
