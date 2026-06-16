/**
 * Auth configuration resolved from the environment.
 *
 * Pure and network-free so it can be unit-tested and used to fail fast at boot.
 * Turning `jwksUrl` into an actual key resolver (jose's createRemoteJWKSet) is
 * the caller's job — see `auth-proxy.ts` / the runtime wiring.
 */

export type AuthMode = 'oidc' | 'proxy';

export interface OidcCredentials {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

export interface ProxyJwtSettings {
  header: string;
  audience: string;
  emailClaim: string;
  jwksUrl: string;
}

export type AuthConfig =
  | { mode: 'oidc'; oidc?: OidcCredentials; namedProviders: string[] }
  | { mode: 'proxy'; emailHeader: string; jwt?: ProxyJwtSettings };

/** Env keys whose mere presence in production indicates an unsafe leftover dev config. */
const DANGEROUS_PROD_ENV = ['DEV_ADMIN_PASSWORD', 'DEV_ADMIN_EMAIL', 'DISABLE_DEV_AUTH'];

type Env = Record<string, string | undefined>;

function namedProvidersFrom(env: Env): string[] {
  const providers: string[] = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push('google');
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) providers.push('github');
  if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) providers.push('microsoft');
  if (env.RESEND_API_KEY && env.EMAIL_FROM) providers.push('email');
  return providers;
}

function resolveProxy(env: Env): AuthConfig {
  const emailHeader = (env.AUTH_PROXY_EMAIL_HEADER ?? 'x-forwarded-email').toLowerCase();

  if (env.AUTH_PROXY_JWKS_URL) {
    if (!env.AUTH_PROXY_JWT_HEADER || !env.AUTH_PROXY_JWT_AUDIENCE) {
      throw new Error(
        'AUTH_PROXY_JWKS_URL requires AUTH_PROXY_JWT_HEADER and AUTH_PROXY_JWT_AUDIENCE to be set.'
      );
    }
    return {
      mode: 'proxy',
      emailHeader,
      jwt: {
        header: env.AUTH_PROXY_JWT_HEADER.toLowerCase(),
        audience: env.AUTH_PROXY_JWT_AUDIENCE,
        emailClaim: env.AUTH_PROXY_JWT_EMAIL_CLAIM ?? 'email',
        jwksUrl: env.AUTH_PROXY_JWKS_URL,
      },
    };
  }

  return { mode: 'proxy', emailHeader };
}

function resolveOidc(env: Env): AuthConfig {
  const isProd = env.NODE_ENV === 'production';
  const namedProviders = namedProvidersFrom(env);

  let oidc: OidcCredentials | undefined;
  if (env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET) {
    oidc = {
      issuer: env.OIDC_ISSUER,
      clientId: env.OIDC_CLIENT_ID,
      clientSecret: env.OIDC_CLIENT_SECRET,
    };
  }

  if (isProd && !oidc && namedProviders.length === 0) {
    throw new Error(
      'No auth provider configured for production: set OIDC_ISSUER/OIDC_CLIENT_ID/OIDC_CLIENT_SECRET ' +
        'or a named provider (Google/GitHub/Microsoft/Resend), or use AUTH_MODE=proxy.'
    );
  }

  return { mode: 'oidc', oidc, namedProviders };
}

function assertNoDangerousLeftovers(env: Env): void {
  if (env.NODE_ENV !== 'production') return;
  const present = DANGEROUS_PROD_ENV.filter((k) => env[k] !== undefined);
  if (present.length > 0) {
    throw new Error(
      `Refusing to boot: insecure dev-auth env present in production: ${present.join(', ')}. Remove it.`
    );
  }
}

export function resolveAuthConfig(env: Env = process.env): AuthConfig {
  assertNoDangerousLeftovers(env);

  const mode = env.AUTH_MODE ?? 'oidc';
  if (mode !== 'oidc' && mode !== 'proxy') {
    throw new Error(`Invalid AUTH_MODE "${mode}": expected "oidc" or "proxy".`);
  }

  return mode === 'proxy' ? resolveProxy(env) : resolveOidc(env);
}
