import { SignJWT, generateKeyPair } from 'jose';
import { resolveProxyIdentity } from '@/lib/auth-proxy';

describe('resolveProxyIdentity — header mode (no JWT verification configured)', () => {
  const config = { emailHeader: 'x-forwarded-email' };

  it('returns the email from the configured header', async () => {
    const headers = new Headers({ 'x-forwarded-email': 'alice@example.com' });
    await expect(resolveProxyIdentity(headers, config)).resolves.toEqual({
      email: 'alice@example.com',
    });
  });

  it('normalises the email (trim + lowercase)', async () => {
    const headers = new Headers({ 'x-forwarded-email': '  Alice@Example.COM ' });
    await expect(resolveProxyIdentity(headers, config)).resolves.toEqual({
      email: 'alice@example.com',
    });
  });

  it('returns null when the header is absent', async () => {
    await expect(resolveProxyIdentity(new Headers(), config)).resolves.toBeNull();
  });

  it('returns null when the header is present but empty', async () => {
    const headers = new Headers({ 'x-forwarded-email': '   ' });
    await expect(resolveProxyIdentity(headers, config)).resolves.toBeNull();
  });
});

describe('resolveProxyIdentity — JWT verification mode', () => {
  const AUD = 'bunting-admin';
  const JWT_HEADER = 'cf-access-jwt-assertion';

  let privateKey: CryptoKey;
  let publicKey: CryptoKey;
  let wrongKey: CryptoKey;

  beforeAll(async () => {
    ({ privateKey, publicKey } = await generateKeyPair('RS256'));
    ({ privateKey: wrongKey } = await generateKeyPair('RS256'));
  });

  function makeConfig(keyResolver: CryptoKey) {
    return {
      emailHeader: 'x-forwarded-email',
      jwt: { header: JWT_HEADER, audience: AUD, emailClaim: 'email', keyResolver },
    };
  }

  async function signToken(
    claims: Record<string, unknown>,
    opts: { audience?: string; key?: CryptoKey } = {}
  ) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setAudience(opts.audience ?? AUD)
      .setExpirationTime('5m')
      .sign(opts.key ?? privateKey);
  }

  it('returns the email claim from a validly signed token', async () => {
    const token = await signToken({ email: 'Bob@Example.com' });
    const headers = new Headers({ [JWT_HEADER]: token });
    await expect(resolveProxyIdentity(headers, makeConfig(publicKey))).resolves.toEqual({
      email: 'bob@example.com',
    });
  });

  it('returns null for a token signed by the wrong key', async () => {
    const token = await signToken({ email: 'bob@example.com' }, { key: wrongKey });
    const headers = new Headers({ [JWT_HEADER]: token });
    await expect(resolveProxyIdentity(headers, makeConfig(publicKey))).resolves.toBeNull();
  });

  it('returns null when the audience does not match', async () => {
    const token = await signToken({ email: 'bob@example.com' }, { audience: 'someone-else' });
    const headers = new Headers({ [JWT_HEADER]: token });
    await expect(resolveProxyIdentity(headers, makeConfig(publicKey))).resolves.toBeNull();
  });

  it('returns null when the JWT header is absent', async () => {
    await expect(resolveProxyIdentity(new Headers(), makeConfig(publicKey))).resolves.toBeNull();
  });

  it('returns null when the verified token lacks the email claim', async () => {
    const token = await signToken({ sub: 'no-email-here' });
    const headers = new Headers({ [JWT_HEADER]: token });
    await expect(resolveProxyIdentity(headers, makeConfig(publicKey))).resolves.toBeNull();
  });

  it('ignores the plain email header in JWT mode (no downgrade to unsigned trust)', async () => {
    // A valid-looking email header must NOT grant access when signed mode is on.
    const headers = new Headers({ 'x-forwarded-email': 'attacker@example.com' });
    await expect(resolveProxyIdentity(headers, makeConfig(publicKey))).resolves.toBeNull();
  });
});
