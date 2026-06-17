import { artifactUrlFor, buildS3Config } from '@/lib/storage';

describe('artifactUrlFor', () => {
	it('derives a directory URL from CDN_BASE_URL', () => {
		const env = { CDN_BASE_URL: 'https://cdn.example.com' };
		expect(artifactUrlFor('com.acme.app', env)).toBe(
			'https://cdn.example.com/com.acme.app/',
		);
	});

	it('trims a trailing slash on CDN_BASE_URL', () => {
		const env = { CDN_BASE_URL: 'https://cdn.example.com/' };
		expect(artifactUrlFor('com.acme.app', env)).toBe(
			'https://cdn.example.com/com.acme.app/',
		);
	});

	it('falls back to S3 endpoint + bucket when no CDN is set (MinIO/custom)', () => {
		const env = {
			S3_ENDPOINT: 'http://localhost:9000',
			S3_BUCKET: 'bunting-configs',
		};
		expect(artifactUrlFor('demo', env)).toBe(
			'http://localhost:9000/bunting-configs/demo/',
		);
	});

	it('falls back to AWS virtual-host style when only bucket/region are set', () => {
		const env = { S3_BUCKET: 'bunting-configs', S3_REGION: 'eu-west-1' };
		expect(artifactUrlFor('demo', env)).toBe(
			'https://bunting-configs.s3.eu-west-1.amazonaws.com/demo/',
		);
	});

	it('returns empty string for an empty identifier', () => {
		expect(
			artifactUrlFor('', { CDN_BASE_URL: 'https://cdn.example.com' }),
		).toBe('');
	});
});

describe('buildS3Config', () => {
	it('includes explicit credentials when both env keys are present (local/MinIO)', () => {
		const cfg = buildS3Config({
			S3_ENDPOINT: 'http://localhost:9000',
			S3_ACCESS_KEY_ID: 'admin',
			S3_SECRET_ACCESS_KEY: 'admin123',
			S3_REGION: 'us-east-1',
		});
		expect(cfg.credentials).toEqual({
			accessKeyId: 'admin',
			secretAccessKey: 'admin123',
		});
		expect(cfg.endpoint).toBe('http://localhost:9000');
		expect(cfg.region).toBe('us-east-1');
		expect(cfg.forcePathStyle).toBe(true);
	});

	it('omits credentials entirely when keys are absent (IAM role / default chain)', () => {
		const cfg = buildS3Config({ S3_REGION: 'eu-west-1' });
		expect('credentials' in cfg).toBe(false);
		expect(cfg.region).toBe('eu-west-1');
	});

	it('omits credentials if only one key is present (never sends a half credential)', () => {
		const cfg = buildS3Config({ S3_ACCESS_KEY_ID: 'admin' });
		expect('credentials' in cfg).toBe(false);
	});

	it('defaults region to us-east-1', () => {
		expect(buildS3Config({}).region).toBe('us-east-1');
	});
});
