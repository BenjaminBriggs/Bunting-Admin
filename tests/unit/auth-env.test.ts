import { resolveAuthConfig } from '@/lib/auth-env';

describe('resolveAuthConfig — mode selection', () => {
  it('defaults to oidc mode when AUTH_MODE is unset', () => {
    const cfg = resolveAuthConfig({ NODE_ENV: 'development', OIDC_ISSUER: 'http://dex' });
    expect(cfg.mode).toBe('oidc');
  });

  it('throws on an unknown AUTH_MODE', () => {
    expect(() => resolveAuthConfig({ AUTH_MODE: 'magic' })).toThrow(/AUTH_MODE/);
  });
});

describe('resolveAuthConfig — proxy mode', () => {
  it('defaults the email header to x-forwarded-email', () => {
    const cfg = resolveAuthConfig({ AUTH_MODE: 'proxy' });
    expect(cfg).toMatchObject({ mode: 'proxy', emailHeader: 'x-forwarded-email' });
  });

  it('honours a custom email header', () => {
    const cfg = resolveAuthConfig({
      AUTH_MODE: 'proxy',
      AUTH_PROXY_EMAIL_HEADER: 'X-Auth-Email',
    });
    expect(cfg).toMatchObject({ mode: 'proxy', emailHeader: 'x-auth-email' });
  });

  it('builds a jwt config when a JWKS url is provided', () => {
    const cfg = resolveAuthConfig({
      AUTH_MODE: 'proxy',
      AUTH_PROXY_JWKS_URL: 'https://idp.example.com/jwks',
      AUTH_PROXY_JWT_HEADER: 'Cf-Access-Jwt-Assertion',
      AUTH_PROXY_JWT_AUDIENCE: 'bunting',
    });
    expect(cfg).toMatchObject({
      mode: 'proxy',
      jwt: {
        header: 'cf-access-jwt-assertion',
        audience: 'bunting',
        emailClaim: 'email',
        jwksUrl: 'https://idp.example.com/jwks',
      },
    });
  });

  it('throws when a JWKS url is set but header or audience is missing', () => {
    expect(() =>
      resolveAuthConfig({ AUTH_MODE: 'proxy', AUTH_PROXY_JWKS_URL: 'https://idp/jwks' })
    ).toThrow(/AUTH_PROXY_JWT/);
  });
});

describe('resolveAuthConfig — production safety', () => {
  it('throws in production when oidc mode has no usable provider', () => {
    expect(() => resolveAuthConfig({ NODE_ENV: 'production', AUTH_MODE: 'oidc' })).toThrow(
      /no auth provider/i
    );
  });

  it('accepts production oidc mode with generic OIDC credentials', () => {
    const cfg = resolveAuthConfig({
      NODE_ENV: 'production',
      AUTH_MODE: 'oidc',
      OIDC_ISSUER: 'https://idp.example.com',
      OIDC_CLIENT_ID: 'abc',
      OIDC_CLIENT_SECRET: 'shh',
    });
    expect(cfg).toMatchObject({
      mode: 'oidc',
      oidc: { issuer: 'https://idp.example.com', clientId: 'abc', clientSecret: 'shh' },
    });
  });

  it('accepts production oidc mode with a named provider configured', () => {
    const cfg = resolveAuthConfig({
      NODE_ENV: 'production',
      AUTH_MODE: 'oidc',
      GOOGLE_CLIENT_ID: 'g',
      GOOGLE_CLIENT_SECRET: 'gs',
    });
    expect(cfg.mode).toBe('oidc');
  });

  it('does not require a provider in development (dex supplies it)', () => {
    expect(() => resolveAuthConfig({ NODE_ENV: 'development', AUTH_MODE: 'oidc' })).not.toThrow();
  });

  it('refuses to boot in production if dangerous dev-auth leftovers are set', () => {
    expect(() =>
      resolveAuthConfig({
        NODE_ENV: 'production',
        AUTH_MODE: 'oidc',
        OIDC_ISSUER: 'https://idp',
        OIDC_CLIENT_ID: 'a',
        OIDC_CLIENT_SECRET: 'b',
        DEV_ADMIN_PASSWORD: 'admin',
      })
    ).toThrow(/dev-auth|DEV_ADMIN/i);
  });
});
