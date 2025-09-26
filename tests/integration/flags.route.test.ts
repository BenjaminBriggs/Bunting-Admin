import { NextRequest } from 'next/server';
import { POST } from '@/app/api/flags/route';
import { prisma } from '@/lib/db';

describe('flags route', () => {
  test('creates a flag', async () => {
    const app = await prisma.app.create({
      data: {
        name: 'Test App',
        identifier: `app-${Date.now()}`,
        artifactUrl: 'https://example.com/config.json',
        publicKeys: [
          {
            kid: 'test-key-1',
            pem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtestkey\n-----END PUBLIC KEY-----'
          }
        ],
        fetchPolicy: {
          min_interval_seconds: 60,
          hard_ttl_days: 7
        },
        storageConfig: {
          bucket: 'test-bucket',
          region: 'us-east-1'
        }
      }
    });

    const req = new NextRequest('http://local/api/flags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: 'new-flag',
        displayName: 'New Flag',
        type: 'bool',
        description: 'flag created in test',
        defaultValues: {
          development: true,
          staging: false,
          production: false
        },
        appId: app.id
      })
    });

    const res = await POST(req);
    expect(res.ok).toBe(true);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.key).toBe('new-flag');
    expect(json.appId).toBe(app.id);
    expect(json.variants.development).toEqual([]);
  });
});
