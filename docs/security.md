# Security

This document covers the security model for operators running Bunting Admin in production.

---

## Signing-key lifecycle

Bunting Admin generates RSA-2048 keys (RS256) via the admin UI. Private keys are never persisted as plaintext — they are encrypted at rest using one of two schemes configured via environment variables (see [`.env.example`](../.env.example)).

### Key generation

Keys are generated inside the app using Node's `crypto.generateKeyPair`. The public key (PEM, SPKI format) is stored unencrypted and distributed to SDK clients via the bootstrap files (`BuntingConfig.plist` and `bunting_config.json`). The private key is encrypted immediately before being written to the database.

Creating an app mints two keys: an **ACTIVE** key and a **STANDBY** key. The first bootstrap file you download therefore already trusts the key your first rotation will switch to.

### Key statuses

Every signing key has exactly one status (`signing_keys.status`):

| Status    | Signs publishes                   | In bootstrap files | Allowed transitions                                        |
| --------- | --------------------------------- | ------------------ | ---------------------------------------------------------- |
| `ACTIVE`  | Yes (exactly one per app)         | Yes, listed first  | Becomes `STANDBY` only when another key is activated       |
| `STANDBY` | No                                | Yes                | Activate (becomes `ACTIVE`), or retire (becomes `RETIRED`) |
| `RETIRED` | No, and can never be re-activated | No                 | Delete                                                     |

- The `ACTIVE` key can't be retired or deleted. Activate a standby key first. (The only exception is deleting the whole app; see [Deleting an app](#deleting-an-app).)
- Only `RETIRED` keys can be deleted. Deleting a key destroys its private half; export it first if you might ever need it.
- Activation is atomic: the previous `ACTIVE` key drops to `STANDBY` in the same transaction, so it stays trusted and in new bootstrap files.
- New keys (Settings → Signing keys → **New standby key**, or `POST /api/keys`) always start as `STANDBY`.
- Every publish and every bootstrap download first makes sure the app has an `ACTIVE` key and at least one `STANDBY` key. With no `ACTIVE` key, the oldest `STANDBY` key is promoted; a fresh `ACTIVE` key is minted only when the app has no `ACTIVE` or `STANDBY` key at all. If no `STANDBY` key is left (an app created before key statuses existed, or after its last standby was activated or retired), a new one is minted, so every bootstrap file carries a rotation target. `RETIRED` keys are never re-activated.

### Bootstrap files and trust

The SDK trusts exactly the public keys that were in the bootstrap file when the app was built. A config signed by any other key is rejected and the app keeps its last cached config. That is why the bootstrap files list every non-retired key: a binary built today trusts the current `ACTIVE` key and every `STANDBY` key, so activating one of those standby keys later doesn't break it.

### Exporting and importing keys

The database is the only place private keys live. To back a key up, or move it to another instance, an admin exports it (Settings → Signing keys → **Export**, or `POST /api/keys/export`). The export is a versioned JSON file (`format: "bunting-signing-key"`, `formatVersion: 1`) holding the key's metadata (app identifier, `kid`, status, creation time) and its private key (PKCS#8 DER) encrypted with AES-256-GCM. The encryption key is derived from a passphrase of at least 12 characters with scrypt (N=2^17, r=8, p=1, random 16-byte salt); the KDF parameters, salt, 12-byte IV and authentication tag are stored in the file. The metadata and KDF parameters are authenticated as GCM additional data, so editing any of them makes import fail. Anyone with the file and the passphrase can sign configs your apps will trust, so store them separately, ideally in a secrets manager.

Import (`POST /api/keys/import`) accepts scrypt costs between N=2^14 and N=2^18 (r=8, p=1), decrypts the file with the passphrase, checks that it is an RSA key of at least 2048 bits with a valid key ID, re-encrypts it with this instance's at-rest scheme, and adds it to the target app as `STANDBY` with its original `kid`. Key IDs are unique per instance, so a key can't be imported while a key with the same `kid` (or the same key material) exists anywhere on the instance; to move a key between apps on one instance, export it, retire and delete it in the source app, then import it. Neither the passphrase nor any key material is ever logged; export and import are recorded in the activity log by key ID only.

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

The Bunting SDK verifies config signatures offline using the public keys embedded in the app bundle at build time. Rotation is therefore always: make sure the key you are about to sign with is already in the builds you care about, then switch to it.

### Planned rotation

1. In Settings → Signing keys, confirm the app has a `STANDBY` key. Apps created by this version of the admin have one from the start, and every build made from a bootstrap file downloaded since then trusts it.
2. **Activate** the standby key. New publishes are signed with it, and the previous active key becomes `STANDBY` (still trusted, still in new bootstrap files).
3. Click **New standby key** to mint the next rotation target.
4. **Publish** so the live `config.json` is signed with the newly active key. Builds that trust it verify the new config; builds that don't keep their last cached config.
5. Download fresh bootstrap files and **ship new binaries**. They trust the new active key, the previous key and the new standby key.
6. When the binaries that only trust the previous key have aged out (no longer in meaningful use), **retire** it, and optionally export and then delete it.

Step 2 only keeps every build working when the standby key was created before those builds' bootstrap files were downloaded. Keys created later (including imported keys) are only trusted by builds made after they were added.

### Suspected compromise

1. **Retire** the compromised key if it is `STANDBY`. If it is `ACTIVE`, first **activate** a standby key (one that was not exposed), then retire the compromised key. Retiring removes it from new bootstrap files and it can never sign again from this instance.
2. **Publish** immediately so the live config is signed with the uncompromised key.
3. Mint a **new standby key**, download fresh bootstrap files and **ship new binaries** that no longer trust the compromised key. Builds already in the field keep trusting it, because embedded keys can't be revoked remotely: an attacker holding that private key can serve those builds a forged config until they are updated.
4. Investigate how the key leaked (database access, `SIGNING_KEY_SECRET` or KMS permissions, export files) before relying on the remaining keys.

If no uncompromised standby key exists, you have to activate a key that shipped builds don't trust. Those builds then stop receiving updates (they keep their last cached config) until users install a new binary.

**Do not:**

- Activate a key that your shipped builds don't trust. They will reject every config published afterwards.
- Retire a key while builds that only trust it are still in use, unless it is compromised. Retired keys can never be re-activated.
- Delete a key you haven't exported. Deletion destroys the private key permanently.

### Deleting an app

Signing keys never cascade with their app (`onDelete: Restrict`). `DELETE /api/apps/[id]` is admin-only, needs the app identifier typed as confirmation, and is refused with `409` while the app still has keys unless the request also sets `deleteSigningKeys: true`; the settings dialog lists the keys with export buttons and an acknowledgment checkbox first. The app's last `config.json` stays in storage, so shipped binaries keep using it, but they will never receive another update. If those binaries are still live, deleting the app and its keys breaks verification for them permanently: even if you recreate an app with the same identifier, its configs are signed with new keys those builds don't trust. Export the keys first if you might ever restore the app, and import them into the recreated app before its first publish.

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

- **`oidc` mode:** the first user to sign in is granted `ADMIN` — but only on a genuinely fresh install, i.e. both the `User` table and the `AccessList` table are empty. If the access list already has any entry (for example because a `proxy`-mode instance bootstrapped first, see below), sign-in is checked against it like any subsequent user instead. The bootstrapped admin is written into the `AccessList` table as an `ADMIN` email entry so the bootstrap survives their next sign-in.
- **`proxy` mode:** there's no discrete sign-in event to hook a bootstrap into, so the same outcome is reached directly against the access list instead: the first authenticated proxy request on an instance with a completely empty `AccessList` (and no `ADMIN` `User` row) is granted `ADMIN` and written into the `AccessList` table. Race-safe via a Postgres advisory lock, so two concurrent first requests can't both bootstrap as `ADMIN`.
- Whichever mode bootstraps first "claims" the instance — the two paths are mutually exclusive by construction (each requires `AccessList` to still be empty).
- Subsequent users get `DEVELOPER` unless their email or `@domain` appears in the `AccessList` table with an explicit role.
- Admins can manage the access list under Settings → Team in the dashboard.

### API authorization coverage

**Authentication** is enforced globally: `src/middleware.ts` rejects any unauthenticated request (401 for `/api/*`, redirect otherwise) before it reaches a route handler. Authentication cannot be done per-route in the handlers themselves for the role check because Prisma is not available in the edge middleware runtime.

**Authorization** (role checks) is enforced per-route in node-runtime handlers via `requireAdmin` (`src/lib/authz.ts`), which resolves the caller's role from the `User` table (oidc mode) or the access list (proxy mode):

- **ADMIN-only:** `config/publish`, `keys` (POST/PUT), `keys/[id]` (PUT/DELETE), `keys/export`, `keys/import`, `apps/[id]` (PUT/DELETE), `activity`, `users`, `access-list`, and the `crypto/test` diagnostic (which also 404s in production). All of these, including `users` and `access-list`, use `requireAdmin` uniformly.
- **Any authenticated user (incl. DEVELOPER):** `apps` (GET/POST), `apps/[id]` (GET), `flags`, `tests`, `rollouts`, key reads (`keys` GET, `keys/[id]` GET, `keys/public`), the bootstrap downloads, `me` (the caller's own role, used by the UI to show admin controls), and `config/decode`. Developers may author flags/tests/rollouts and create apps, but may not publish, edit or delete apps, or manage keys/users. Creating an app mints its signing keys server-side; the caller never supplies or sees private keys.

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
