/**
 * Storage configuration — single global bucket model.
 *
 * All apps publish to one bucket (env `S3_BUCKET`), namespaced by app
 * identifier. In production credentials come from the instance's IAM role
 * (Fargate task role); locally they come from env (MinIO). The public read URL
 * the SDK fetches from is derived from `CDN_BASE_URL`.
 */

import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

type Env = Record<string, string | undefined>;

function trimTrailingSlash(url: string): string {
	return url.replace(/\/+$/, '');
}

/**
 * Public URL of the `config.json` artifact the SDK fetches. The signature lives
 * alongside it at this URL + ".sig" — the SDK derives that suffix itself, so this
 * must point at the exact `config.json` object, not its containing directory.
 */
export function artifactUrlFor(
	appIdentifier: string,
	env: Env = process.env,
): string {
	if (!appIdentifier) {
		return '';
	}

	if (env.CDN_BASE_URL) {
		return `${trimTrailingSlash(env.CDN_BASE_URL)}/${appIdentifier}/config.json`;
	}

	// Local/custom S3-compatible endpoint (e.g. MinIO): path-style URL.
	if (env.S3_ENDPOINT && env.S3_BUCKET) {
		return `${trimTrailingSlash(env.S3_ENDPOINT)}/${env.S3_BUCKET}/${appIdentifier}/config.json`;
	}

	// Plain AWS S3: virtual-host style.
	if (env.S3_BUCKET) {
		const region = env.S3_REGION ?? 'us-east-1';
		return `https://${env.S3_BUCKET}.s3.${region}.amazonaws.com/${appIdentifier}/config.json`;
	}

	return '';
}

/**
 * Normalizes a possibly-legacy directory-shaped `artifactUrl` (stored with a
 * trailing slash by older versions of `artifactUrlFor`) to the full
 * `config.json` URL the SDK expects. Already-correct values pass through
 * unchanged. Apply this wherever a stored `artifactUrl` is emitted to SDK-facing
 * output, since existing rows may still hold the old directory shape.
 */
export function normalizeArtifactUrl(url: string): string {
	if (!url) {
		return url;
	}
	return url.endsWith('/') ? `${url}config.json` : url;
}

/**
 * Build S3 client config. Explicit credentials are sent ONLY when both env keys
 * are present (local/MinIO); otherwise they are omitted so the AWS SDK uses its
 * default provider chain — i.e. the IAM role in production.
 */
export function buildS3Config(env: Env = process.env): S3ClientConfig {
	const config: S3ClientConfig = {
		region: env.S3_REGION ?? 'us-east-1',
		forcePathStyle: true, // required for MinIO; harmless on AWS
	};

	if (env.S3_ENDPOINT) {
		config.endpoint = env.S3_ENDPOINT;
	}

	if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
		config.credentials = {
			accessKeyId: env.S3_ACCESS_KEY_ID,
			secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		};
	}

	return config;
}

export function getS3Client(): S3Client {
	return new S3Client(buildS3Config());
}

/** The single configured bucket; throws if unset so callers fail loudly. */
export function getConfigBucket(): string {
	const bucket = process.env.S3_BUCKET;
	if (!bucket) {
		throw new Error('S3_BUCKET is not configured');
	}
	return bucket;
}

/** S3 key for the latest config the SDK fetches (overwritten each publish). */
export function latestConfigKey(appIdentifier: string): string {
	return `${appIdentifier}/config.json`;
}

/**
 * S3 key for the immutable per-version archive written at publish time. Lets the
 * admin fetch the exact bytes of any historical version (e.g. to decode a
 * client fingerprint), since `config.json` is overwritten in place.
 */
export function versionedConfigKey(
	appIdentifier: string,
	version: string,
): string {
	return `${appIdentifier}/config-${version}.json`;
}
