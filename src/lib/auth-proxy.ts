/**
 * Forward-auth (reverse-proxy) identity resolution.
 *
 * When the app runs behind a trusted identity-aware proxy (oauth2-proxy,
 * Pomerium, Cloudflare Access, Google IAP, or Guardian SSO), the proxy
 * authenticates the user and passes their identity to the app. This module
 * extracts and (optionally) cryptographically verifies that identity.
 *
 * Two trust levels:
 *  - JWT verification (preferred): the proxy passes a signed assertion that we
 *    verify against its JWKS and expected audience. Tamper-proof.
 *  - Plain header (fallback): we trust an identity header. ONLY safe when the
 *    app is network-isolated so the header cannot reach us except via the proxy.
 */

import { jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface ProxyJwtConfig {
  /** Header carrying the signed assertion, e.g. 'cf-access-jwt-assertion'. */
  header: string;
  /** Expected `aud` claim. */
  audience: string;
  /** Claim to read the email from (default 'email'). */
  emailClaim?: string;
  /** Verification key or remote JWKS resolver (e.g. jose's createRemoteJWKSet). */
  keyResolver: JWTVerifyGetKey | CryptoKey | Uint8Array;
}

export interface ProxyAuthConfig {
  /** Header carrying the user's email in plain-header mode, e.g. 'x-forwarded-email'. */
  emailHeader: string;
  /**
   * When set, identity is taken ONLY from a cryptographically verified assertion;
   * the plain email header is ignored (prevents downgrade to unsigned trust).
   */
  jwt?: ProxyJwtConfig;
}

export interface ProxyIdentity {
  email: string;
}

function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

async function resolveFromJwt(
  headers: Headers,
  jwt: ProxyJwtConfig
): Promise<ProxyIdentity | null> {
  const token = headers.get(jwt.header);
  if (!token) return null;

  try {
    // jose's overloads differ for key vs. resolver; the runtime accepts both.
    const { payload } = await jwtVerify(token, jwt.keyResolver as JWTVerifyGetKey, {
      audience: jwt.audience,
    });
    const email = normaliseEmail(payload[jwt.emailClaim ?? 'email']);
    return email ? { email } : null;
  } catch {
    return null;
  }
}

export async function resolveProxyIdentity(
  headers: Headers,
  config: ProxyAuthConfig
): Promise<ProxyIdentity | null> {
  if (config.jwt) {
    return resolveFromJwt(headers, config.jwt);
  }
  const email = normaliseEmail(headers.get(config.emailHeader));
  return email ? { email } : null;
}
