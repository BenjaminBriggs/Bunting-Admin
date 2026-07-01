type ConfigArtifact = { app_identifier: string; flags: Record<string, unknown> };
type ValidationResult = {
	errors: Array<{ type: string; message: string; flagKey?: string }>;
	warnings: Array<{ type: string; message: string; flagKey?: string }>;
};
interface SignResult {
	keyId: string;
	algorithm: string;
	signature: string;
}
interface TxStub {
	$executeRaw: () => Promise<unknown>;
	auditLog: {
		findMany: () => Promise<unknown[]>;
		create: () => Promise<{ id: string }>;
	};
}

const mockRequireAdmin = jest.fn<
	Promise<{ email: string } | { status: number }>,
	[Headers]
>();
const mockGenerateConfigFromDb = jest.fn<Promise<ConfigArtifact>, [string]>();
const mockValidateConfig = jest.fn<ValidationResult, [unknown]>();
const mockGetConfigChanges = jest.fn<unknown[], unknown[]>();
const mockEnsureSigningKey = jest.fn<Promise<void>, [string]>();
const mockSignConfigDetached = jest.fn<Promise<SignResult>, unknown[]>();
const mockS3Send = jest.fn<Promise<unknown>, unknown[]>();
const mockDbTransaction = jest.fn<
	Promise<unknown>,
	[(tx: TxStub) => Promise<unknown>]
>();
const mockAuditLogUpdate = jest.fn<Promise<unknown>, unknown[]>();
const mockFlagUpdateMany = jest.fn<Promise<{ count: number }>, unknown[]>();

jest.mock('@/lib/authz', () => ({
	requireAdmin: (headers: Headers) => mockRequireAdmin(headers),
}));

jest.mock('@/lib/config-generator', () => ({
	generateConfigFromDb: (appId: string) => mockGenerateConfigFromDb(appId),
	AppNotFoundError: class AppNotFoundError extends Error {},
}));

jest.mock('@/lib/config-validation', () => ({
	validateConfig: (config: unknown) => mockValidateConfig(config),
}));

jest.mock('@/lib/config-comparison', () => ({
	getConfigChanges: (...args: unknown[]) => mockGetConfigChanges(...args),
}));

jest.mock('@/lib/jws-signer', () => ({
	ensureSigningKey: (appId: string) => mockEnsureSigningKey(appId),
	signConfigDetached: (...args: unknown[]) => mockSignConfigDetached(...args),
}));

jest.mock('@/lib/storage', () => ({
	getConfigBucket: () => 'bunting-configs',
	getS3Client: () => ({ send: (...args: unknown[]) => mockS3Send(...args) }),
	latestConfigKey: (appIdentifier: string) => `${appIdentifier}/config.json`,
	versionedConfigKey: (appIdentifier: string, version: string) =>
		`${appIdentifier}/versions/${version}.json`,
}));

jest.mock('@/lib/versioning', () => ({
	computeNextVersion: () => '2025-01-01.1',
}));

jest.mock('@/lib/db', () => ({
	prisma: {
		$transaction: (cb: (tx: TxStub) => Promise<unknown>) =>
			mockDbTransaction(cb),
		auditLog: {
			update: (...args: unknown[]) => mockAuditLogUpdate(...args),
		},
		flag: {
			updateMany: (...args: unknown[]) => mockFlagUpdateMany(...args),
		},
	},
}));

// Imported after the jest.mock calls so the mocked dependencies register first.
// eslint-disable-next-line import/first -- jest.mock must register before import
import { NextRequest } from 'next/server';
// eslint-disable-next-line import/first -- jest.mock must register before import
import { POST } from '@/app/api/config/publish/route';

function req(body: unknown): NextRequest {
	return new NextRequest('http://local/api/config/publish', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	mockRequireAdmin.mockReset();
	mockGenerateConfigFromDb.mockReset();
	mockValidateConfig.mockReset();
	mockGetConfigChanges.mockReset();
	mockEnsureSigningKey.mockReset();
	mockSignConfigDetached.mockReset();
	mockS3Send.mockReset();
	mockDbTransaction.mockReset();
	mockAuditLogUpdate.mockReset();
	mockFlagUpdateMany.mockReset();

	mockRequireAdmin.mockResolvedValue({ email: 'admin@x.com' });
	mockGenerateConfigFromDb.mockResolvedValue({
		app_identifier: 'test-app',
		flags: {
			'store/bad_json': { type: 'json', development: { default: {} } },
		},
	});
	mockGetConfigChanges.mockReturnValue([]);
});

describe('POST /api/config/publish — validation gate', () => {
	it('rejects an invalid config with 400 before any signing key, version, or S3 interaction', async () => {
		mockValidateConfig.mockReturnValue({
			errors: [
				{
					type: 'invalid_json',
					message:
						'Flag "store/bad_json" has a non-string json value for development default — json values must be JSON-encoded strings',
					flagKey: 'store/bad_json',
				},
			],
			warnings: [],
		});

		const res = await POST(req({ appId: 'app-1', changelog: 'oops' }));

		expect(res.status).toBe(400);
		const body = (await res.json()) as {
			error: string;
			errors: unknown[];
		};
		expect(body.error).toMatch(/invalid/i);
		expect(body.errors).toHaveLength(1);

		// No side effects: nothing consumed, nothing signed, nothing uploaded.
		expect(mockEnsureSigningKey).not.toHaveBeenCalled();
		expect(mockDbTransaction).not.toHaveBeenCalled();
		expect(mockSignConfigDetached).not.toHaveBeenCalled();
		expect(mockS3Send).not.toHaveBeenCalled();
	});

	it('does not reject on warnings alone (non-blocking) and proceeds to publish', async () => {
		mockValidateConfig.mockReturnValue({
			errors: [],
			warnings: [{ type: 'unused_flag', message: 'heads up', flagKey: 'x' }],
		});
		mockEnsureSigningKey.mockResolvedValue(undefined);
		mockDbTransaction.mockImplementation((cb) =>
			cb({
				$executeRaw: () => Promise.resolve(undefined),
				auditLog: {
					findMany: () => Promise.resolve([]),
					create: () => Promise.resolve({ id: 'audit-1' }),
				},
			}),
		);
		mockSignConfigDetached.mockResolvedValue({
			keyId: 'key-1',
			algorithm: 'RS256',
			signature: 'sig-bytes',
		});
		mockS3Send.mockResolvedValue({});
		mockAuditLogUpdate.mockResolvedValue({});
		mockFlagUpdateMany.mockResolvedValue({ count: 0 });

		const res = await POST(req({ appId: 'app-1', changelog: 'ok' }));

		expect(res.status).toBe(200);
		expect(mockEnsureSigningKey).toHaveBeenCalled();
		expect(mockS3Send).toHaveBeenCalled();
	});
});
