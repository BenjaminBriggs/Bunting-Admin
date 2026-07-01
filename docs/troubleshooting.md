# Troubleshooting

A few common hiccups and how to recover from them.

## Database Connection Errors

```bash
docker compose down
docker compose up -d
pnpm dlx prisma db push
```

- Ensure Docker is running and ports 5432/9000/9001 are free.
- Delete any local `.env` overrides that point to unreachable databases.

## MinIO Issues

- Visit http://localhost:9001 and confirm the required buckets exist.
- Restart the containers if credentials were changed.

## Development Keys Missing

```bash
rm -rf keys/
node scripts/generate-dev-keys.js
```

- The keys directory is ignored by git; regenerate them whenever you clone the project afresh.

Still stuck? Open a GitHub discussion or file an issue with logs and the command you ran.

---

## Production failure modes

### Signature verification failures (SDK side)

The Swift SDK verifies every config fetch against a JWS signature. It prefers the `x-bunting-signature` response header, but if the header is absent it automatically falls back to fetching the companion `config.json.sig` object as a sibling of `config.json` — a missing header is expected and not itself a failure (see [deployment.md](deployment.md#cdn-configuration-for-sdk-signature-verification)).

**`.sig` fetch fails (404/403):** If the header is absent _and_ `config.json.sig` isn't reachable at the same path prefix as `config.json`, verification fails outright. Confirm the `.sig` object was uploaded alongside `config.json` and that your CDN/bucket policy serves it with the same public access as the config itself. Fetch both URLs with `curl -I` and check for `200`.

**`.sig` reachable (or header present) but verification still fails:** The bytes served differ from the bytes that were signed. Common causes:

- CDN is gzip/br compressing the body but serving the header for the uncompressed bytes, or vice versa. Ensure the CDN does not re-encode the body after signing.
- A CDN cache layer is serving a stale `config.json` with the `.sig` from a newer publish. ETag-based invalidation must be atomic across both files.
- The signing key used at publish time is no longer in the app's bootstrap plist. Add the new public key to the plist and ship an app update before activating the new signing key — see [security.md](security.md).

**Admin-side check:** In the Releases section, re-publish to regenerate the signature from the current config bytes.

### S3 / CDN connectivity

```bash
# Check admin can reach the bucket
AWS_REGION=us-east-1 aws s3 ls s3://bunting-configs/

# Check CDN URL resolves the artifact
curl -I https://cdn.example.com/<app-identifier>/config.json
```

Symptoms of misconfiguration:

- `S3_BUCKET is not configured` — `S3_BUCKET` env var unset.
- `NoSuchBucket` from S3 SDK — bucket does not exist in the configured region.
- Publish succeeds but SDK fetches return 403 — bucket policy does not allow public read, or CDN does not have access to the bucket.
- CDN returns stale config — CloudFront / CDN caching `config.json` longer than `Cache-Control: max-age=300`. Invalidate the CDN path after each publish or configure TTL correctly.

### Auth / OIDC misconfiguration

**App refuses to boot in production:**

```
No auth provider configured for production
```

Set at least one of: `OIDC_ISSUER`+`OIDC_CLIENT_ID`+`OIDC_CLIENT_SECRET`, a named OAuth provider, or `AUTH_MODE=proxy`.

**Sign-in callback error / redirect loop:** `NEXTAUTH_URL` does not match the actual public URL (including scheme and port). Update it and redeploy.

**OIDC discovery fails:** `OIDC_ISSUER` must be reachable at `<issuer>/.well-known/openid-configuration` from the server (not just the browser). Check firewall rules and that the issuer URL does not include a trailing `/`.

**Proxy mode: identity header not arriving:**

- Confirm the header name in `AUTH_PROXY_EMAIL_HEADER` matches exactly what your proxy sends (lowercased).
- If using `AUTH_PROXY_JWKS_URL`, verify `AUTH_PROXY_JWT_HEADER` and `AUTH_PROXY_JWT_AUDIENCE` are also set — the app throws at boot if they are missing.
- Ensure the app is network-isolated so the header cannot be forged by a direct request to port 3000.

### Database migration failures

```bash
# Check migration status
pnpm dlx prisma migrate status

# Apply pending migrations
make db-migrate
```

Common causes:

- Running `db:push` instead of `migrate deploy` in production — `db:push` is for development only and does not track migration history.
- Schema drift: the database was manually altered. Check `prisma migrate status` for detected drift and reconcile manually.
- `P1001 Can't reach database server` — `DATABASE_URL` points to an unreachable host, or the database is not yet healthy. Add `?connect_timeout=10` to the connection string and retry.

### Publish errors

**`No active signing key found for app`:** The app has no signing key with `isActive = true` in the `signing_keys` table. Generate a key in Settings → SDK Integration for the app.

**`Signing-key protection is not configured`:** Neither `SIGNING_KEY_KMS_KEY_ID` nor `SIGNING_KEY_SECRET` is set. The app cannot decrypt the stored private key to sign a config.

**`S3_BUCKET is not configured`:** The `S3_BUCKET` environment variable is missing.

**Publish succeeds but config version is not incrementing:** The `YYYY-MM-DD.N` counter is derived from existing `AuditLog` rows for the same app and date. If the database was wiped and re-migrated, the counter resets. The allocation is serialized by a per-app Postgres advisory lock (`pg_advisory_xact_lock`) so two concurrent publishes can't mint the same `N`.
