/**
 * Production boot-time configuration validation. Imported only from
 * `instrumentation.ts` under the Node.js runtime in production. Importing this
 * module runs the checks and throws (crashing startup) if anything required is
 * missing or misconfigured.
 */
import { resolveAuthConfig } from '@/lib/auth-env';
import { resolveProtectionScheme } from '@/lib/key-protection';
import { getConfigBucket } from '@/lib/storage';

const missing: string[] = [];
if (!process.env.DATABASE_URL) {
	missing.push('DATABASE_URL');
}
if (!process.env.NEXTAUTH_SECRET) {
	missing.push('NEXTAUTH_SECRET');
}
if (missing.length > 0) {
	throw new Error(
		`Missing required environment variables: ${missing.join(', ')}`,
	);
}

// These each throw with an actionable message when their config is absent.
resolveAuthConfig(); // auth providers / no dev-auth leftovers in prod
getConfigBucket(); // S3 bucket configured
resolveProtectionScheme(); // signing-key encryption configured
