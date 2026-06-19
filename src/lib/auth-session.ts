/**
 * Unified request → identity resolution, dispatching on AUTH_MODE.
 *
 * Edge-safe: the proxy path uses only `jose` + headers (no Prisma); the oidc
 * path reads the NextAuth JWT session. Authorization (roles / access list) is
 * deliberately NOT done here — it lives in node-runtime helpers because Prisma
 * cannot run in middleware. See the auth design spec.
 */

import { createRemoteJWKSet } from 'jose';
import { type AuthConfig, resolveAuthConfig } from './auth-env';
import { type ProxyAuthConfig, resolveProxyIdentity } from './auth-proxy';

export interface Identity {
	email: string;
}

// Memoise the remote JWKS per URL — it caches keys and must not be rebuilt per request.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(url: string): ReturnType<typeof createRemoteJWKSet> {
	let set = jwksCache.get(url);
	if (!set) {
		set = createRemoteJWKSet(new URL(url));
		jwksCache.set(url, set);
	}
	return set;
}

/** Resolve identity from request headers in proxy mode. Returns null for non-proxy configs. */
export async function identityFromHeaders(
	headers: Headers,
	config: AuthConfig,
): Promise<Identity | null> {
	if (config.mode !== 'proxy') {
		return null;
	}

	const proxyConfig: ProxyAuthConfig = config.jwt
		? {
				emailHeader: config.emailHeader,
				jwt: {
					header: config.jwt.header,
					audience: config.jwt.audience,
					emailClaim: config.jwt.emailClaim,
					keyResolver: jwksFor(config.jwt.jwksUrl),
				},
			}
		: { emailHeader: config.emailHeader };

	return resolveProxyIdentity(headers, proxyConfig);
}

/** Resolve the authenticated identity for a request, or null if unauthenticated. */
export async function identityFromRequest(
	headers: Headers,
): Promise<Identity | null> {
	const config = resolveAuthConfig();

	if (config.mode === 'proxy') {
		return identityFromHeaders(headers, config);
	}

	// oidc: lazy-load NextAuth so non-oidc paths (and unit tests) don't pull it in.
	const { auth } = await import('./auth');
	const session = await auth();
	// Keep `email` optional-chained: the augmented Session type claims it is a
	// non-null string, but a provider can return a session with no email.
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime email may be absent despite the type
	const email = session?.user?.email?.trim().toLowerCase();
	return email ? { email } : null;
}
