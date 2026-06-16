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

/** Public directory URL the SDK fetches `config.json` / `config.json.sig` from. */
export function artifactUrlFor(appIdentifier: string, env: Env = process.env): string {
  if (!appIdentifier) return '';

  if (env.CDN_BASE_URL) {
    return `${trimTrailingSlash(env.CDN_BASE_URL)}/${appIdentifier}/`;
  }

  // Local/custom S3-compatible endpoint (e.g. MinIO): path-style URL.
  if (env.S3_ENDPOINT && env.S3_BUCKET) {
    return `${trimTrailingSlash(env.S3_ENDPOINT)}/${env.S3_BUCKET}/${appIdentifier}/`;
  }

  // Plain AWS S3: virtual-host style.
  if (env.S3_BUCKET) {
    const region = env.S3_REGION || 'us-east-1';
    return `https://${env.S3_BUCKET}.s3.${region}.amazonaws.com/${appIdentifier}/`;
  }

  return '';
}

/**
 * Build S3 client config. Explicit credentials are sent ONLY when both env keys
 * are present (local/MinIO); otherwise they are omitted so the AWS SDK uses its
 * default provider chain — i.e. the IAM role in production.
 */
export function buildS3Config(env: Env = process.env): S3ClientConfig {
  const config: S3ClientConfig = {
    region: env.S3_REGION || 'us-east-1',
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
