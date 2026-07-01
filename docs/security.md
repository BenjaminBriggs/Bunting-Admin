# Security

This document covers the security model for operators running Bunting Admin in production.

---

## Signing-key lifecycle

Bunting Admin generates RSA-2048 keys (RS256) via the admin UI. Private keys are never persisted as plaintext — they are encrypted at rest using one of two schemes configured via environment variables (see [`.env.example`](../.env.example)).

### Key generation

Keys are generated inside the app using Node's `crypto.generateKeyPair`. The public key (PEM, SPKI format) is stored unencrypted and distributed to SDK clients via the bootstrap plist. The private key is encrypted immediately before being written to the database.

### At-rest protection schemes

**AWS KMS (recommended for production)**

```
SIGNING_KEY_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789:key/key-id
```

The app's IAM role must allow `kms:Encrypt` and `kms:Decrypt` on the key. The RSA-2048 PKCS#8 PEM is under KMS's 4 KB plaintext limit, so no data-key envelope is needed. KMS handles audit logging and access control for free.

**Local AES-256-GCM (self-hosted / dev)**

```
SIGNING_KEY_SECRET=<64 hex chars from `openssl rand -hex 32`>
```

The key is derived per-encryption using scrypt (random 16-byte salt per write), so rotating `SIGNING_KEY_SECRET` invalidates all existing encrypted rows. Re-encrypt them before rotating. Do not use this in production without an external secret manager.

If neither variable is set, the app refuses to generate or sign keys.

### Where keys live

Private keys live in the `signing_keys` table (`private_key` column), stored as a JSON envelope:

```json
{
	"scheme": "local",
	"v": 1,
	"salt": "...",
	"iv": "...",
	"tag": "...",
	"ciphertext": "..."
}
```

or

```json
{ "scheme": "kms", "v": 1, "keyId": "arn:...", "ciphertext": "..." }
```

Legacy plaintext PEM rows (created before encryption was added) are accepted transparently and re-encrypted on next write.

---

## Key rotation runbook

The Bunting SDK verifies config signatures offline using public keys embedded in the app bundle. Multiple public keys are supported so in-field apps keep verifying during rotation.

**Safe rotation steps:**

1. In the admin UI, generate a new signing key for the app. The new key is added with `isActive = false` initially.
2. Update the SDK bootstrap plist (`BuntingConfig.plist`) to include **both** the old and new public keys. Ship this app update.
3. Once the app update has reached an acceptable percentage of your user base (enough that no un-updated builds matter), activate the new signing key in the admin UI. New publishes will be signed with the new key.
4. Old builds continue to verify using the old public key they carry; new builds can verify with either key.
5. After you are confident the old key is not needed, deactivate it. The old public key in shipped app binaries does nothing once no signatures reference its `kid`.

**Do not:**

- Deactivate the old key before shipping the plist update. In-field apps only carry the old public key and will fail verification.
- Delete private keys from the database — the app may need to re-sign historical configs.

---

## Authentication modes

`AUTH_MODE` selects how users authenticate. Set it in your environment before deploying. See [`.env.example`](../.env.example) for all options.

### `oidc` (default)

The app is an OpenID Connect relying party. Bring your own IdP:

| Variable             | Required                    | Notes                                                               |
| -------------------- | --------------------------- | ------------------------------------------------------------------- |
| `OIDC_ISSUER`        | yes (if using generic OIDC) | Must be discoverable at `<issuer>/.well-known/openid-configuration` |
| `OIDC_CLIENT_ID`     | yes                         |                                                                     |
| `OIDC_CLIENT_SECRET` | yes                         |                                                                     |
| `OIDC_PROVIDER_NAME` | no                          | Button label in the UI                                              |
| `OIDC_SCOPES`        | no                          | Defaults to `openid email profile`                                  |

You can also configure named OAuth providers (Google, GitHub, Microsoft) and email magic links (via Resend) in addition to or instead of generic OIDC. All configured providers appear as sign-in options.

Redirect URL to register with your IdP: `<NEXTAUTH_URL>/api/auth/callback/oidc`

In production, if no provider is configured the app refuses to boot.

### `proxy` (trusted reverse-proxy / IAP)

When a trusted identity-aware proxy (oauth2-proxy, Pomerium, Cloudflare Access, Google IAP) sits in front of the app, set `AUTH_MODE=proxy`. The app reads user identity from a request header.

**Plain-header mode (less secure):**

```
AUTH_PROXY_EMAIL_HEADER=x-forwarded-email
```

The app trusts whatever email the proxy sets. This is only safe when the app is network-isolated so the header cannot arrive except from the proxy.

**Signed-JWT mode (preferred):**

```
AUTH_PROXY_JWKS_URL=https://proxy.example.com/.well-known/jwks.json
AUTH_PROXY_JWT_HEADER=cf-access-jwt-assertion
AUTH_PROXY_JWT_AUDIENCE=your-audience
AUTH_PROXY_JWT_EMAIL_CLAIM=email   # optional, defaults to "email"
```

When `AUTH_PROXY_JWKS_URL` is set, the app verifies the signed assertion cryptographically and ignores the plain email header. This prevents downgrade attacks.

### RBAC and first-admin

- The first user to sign in is granted `ADMIN` regardless of access list entries, and is written into the `AccessList` table as an `ADMIN` email entry so the bootstrap survives their next sign-in.
- Subsequent users get `DEVELOPER` unless their email or `@domain` appears in the `AccessList` table with an explicit role.
- Admins can manage the access list under Settings → Team in the dashboard.

### API authorization coverage

**Authentication** is enforced globally: `src/middleware.ts` rejects any unauthenticated request (401 for `/api/*`, redirect otherwise) before it reaches a route handler. Authentication cannot be done per-route in the handlers themselves for the role check because Prisma is not available in the edge middleware runtime.

**Authorization** (role checks) is enforced per-route in node-runtime handlers via `requireAdmin` (`src/lib/authz.ts`), which resolves the caller's role from the `User` table (oidc mode) or the access list (proxy mode):

- **ADMIN-only:** `config/publish`, `keys` (POST/PUT), `keys/[id]` (PUT/DELETE), `activity`, `users`, `access-list`, and the `crypto/test` diagnostic (which also 404s in production). All of these — including `users` and `access-list` — use `requireAdmin` uniformly.
- **Any authenticated user (incl. DEVELOPER):** `apps`, `flags`, `tests`, `rollouts`, key reads (`keys` GET, `keys/[id]` GET, `keys/public`), and `config/decode` — per [authentication.md](../../docs/authentication.md) §Roles, developers may author flags/tests/rollouts/apps but may not publish or manage keys/users.

Defense-in-depth at the network layer (reverse proxy, IAP, or private network) is still recommended, but the application layer no longer leaves routes unauthenticated.

---

## Input validation

All API route handler inputs are validated with Zod schemas before touching the database. Prisma parameterizes all queries — there is no raw SQL exposure. Flag keys are normalized to `snake_case` with namespace support and rejected if they contain invalid characters.

---

## What operators must still provide

Bunting Admin does not implement:

| Concern                        | Operator responsibility                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rate limiting                  | Apply at the reverse proxy or API gateway layer                                                                                                                 |
| Audit-log retention            | The `audit_logs` (publish ledger), `activity_logs` (entity change trail), and `publications` tables grow unbounded; set a retention policy or scheduled pruning |
| Database backups               | Use your Postgres provider's snapshot / PITR capability                                                                                                         |
| Network isolation (proxy mode) | Ensure the app cannot be reached except through the proxy                                                                                                       |
| Secret rotation                | Rotate `NEXTAUTH_SECRET` and `SIGNING_KEY_SECRET` on a schedule; re-encrypt signing keys after rotating `SIGNING_KEY_SECRET`                                    |
| TLS                            | Terminate at the reverse proxy; never expose port 3000 directly                                                                                                 |
