# Production Deployment

This guide covers deploying Bunting Admin beyond the one-click platforms documented in [deployment.md](deployment.md). Read [local-development.md](local-development.md) first to understand the service topology.

All environment variables are documented in [`.env.example`](../.env.example) — that file is the canonical reference. This guide explains the _why_ behind the choices.

---

## Container image

The `Dockerfile` produces a minimal, non-root production image via a multi-stage build:

```
docker build --target runner -t bunting-admin:latest .
```

The image exposes port `3000`. At startup it expects all required env vars to be present — it does not fall back to defaults for secrets.

---

## Docker Compose (production)

The checked-in `docker-compose.yml` is a **development compose** file — it includes MinIO, pgAdmin, a Dex OIDC container, and bind-mounts source code. Do not use it in production.

For production, write a minimal compose file that references your managed services:

```yaml
services:
  app:
    image: bunting-admin:latest
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: '${DATABASE_URL}'
      S3_BUCKET: '${S3_BUCKET}'
      S3_REGION: '${S3_REGION}'
      CDN_BASE_URL: '${CDN_BASE_URL}'
      SIGNING_KEY_KMS_KEY_ID: '${SIGNING_KEY_KMS_KEY_ID}' # or SIGNING_KEY_SECRET
      AUTH_MODE: '${AUTH_MODE}'
      OIDC_ISSUER: '${OIDC_ISSUER}'
      OIDC_CLIENT_ID: '${OIDC_CLIENT_ID}'
      OIDC_CLIENT_SECRET: '${OIDC_CLIENT_SECRET}'
      NEXTAUTH_URL: '${NEXTAUTH_URL}'
      NEXTAUTH_SECRET: '${NEXTAUTH_SECRET}'
    ports:
      - '3000:3000'
```

Run migrations before starting:

```bash
DATABASE_URL="..." pnpm dlx prisma migrate deploy
```

---

## Database

### Managed Postgres (RDS, Aurora, Neon, Supabase)

Set `DATABASE_URL` to the connection string provided by your provider. Bunting Admin uses Prisma — the database must be PostgreSQL 13+.

```
DATABASE_URL="postgresql://user:pass@host:5432/bunting_admin?sslmode=require"
```

Add `?sslmode=require` for hosted providers that enforce TLS. Aurora Serverless v2 and Neon work without any additional config.

**Migrations in production:** use `prisma migrate deploy` (not `db push`) so changes are tracked:

```bash
make db-migrate
```

Run this before each new release, not as part of the app startup command.

### Connection pooling

If you are running multiple replicas, front Postgres with PgBouncer or use Neon's built-in pooler. Set the pool URL in `DATABASE_URL` and add `?pgbouncer=true` if your provider requires it.

---

## Object storage (S3 / S3-compatible)

Bunting Admin stores published config artifacts in a single S3 bucket, namespaced by app identifier (`<bucket>/<app-identifier>/config.json`).

### AWS S3

Omit `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` in production. The app's IAM role (Fargate task role, EC2 instance profile, etc.) is used automatically:

```
S3_BUCKET=bunting-configs
S3_REGION=us-east-1
CDN_BASE_URL=https://cdn.example.com
```

Minimum IAM permissions for the task role:

```json
{
	"Effect": "Allow",
	"Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
	"Resource": ["arn:aws:s3:::bunting-configs", "arn:aws:s3:::bunting-configs/*"]
}
```

### S3-compatible stores (Cloudflare R2, Backblaze B2)

Set `S3_ENDPOINT` to the provider's S3-compatible endpoint and provide credentials explicitly:

```
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_BUCKET=bunting-configs
S3_REGION=auto
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
CDN_BASE_URL=https://cdn.example.com
```

### CDN requirement — critical for signature verification

**The SDK does not fetch artifacts directly from S3. You must front S3 with a CDN.**

The Swift SDK verifies every config fetch using a detached JWS signature. The signature is published as a companion file (`config.json.sig`) alongside `config.json`. Your CDN must:

1. Serve `config.json` from S3.
2. Read the companion `config.json.sig` object.
3. Inject its contents as the `x-bunting-signature` response header on every `config.json` response.

Without this header, every SDK fetch fails signature verification and the SDK falls back to its cached config (or the bundled seed on a fresh install).

**ETag / caching:** S3 sets an ETag on each object. The CDN must pass it through unchanged — the SDK uses conditional `If-None-Match` fetches. Do not strip or rewrite ETags.

Recommended `Cache-Control` for the CDN: `max-age=300, stale-while-revalidate=86400`.

#### CloudFront example

Use a CloudFront Function on the viewer-response event:

```javascript
// viewer-response CloudFront Function
async function handler(event) {
	const request = event.request;
	const response = event.response;

	if (request.uri.endsWith('/config.json')) {
		// Fetch the companion .sig from origin and inject the header.
		// Implementation depends on your CloudFront + Lambda@Edge setup.
		// See the scripts/ directory for a reference implementation.
		const sigUri = request.uri + '.sig';
		// ... fetch sigUri and set response.headers['x-bunting-signature']
	}
	return response;
}
```

The recommended pattern is a Lambda@Edge origin-response function that fetches and caches `.sig` alongside `config.json`.

---

## Reverse proxy and TLS

Run a reverse proxy in front of the Next.js app (`port 3000`) and terminate TLS there.

**nginx example:**

```nginx
server {
    listen 443 ssl;
    server_name admin.example.com;

    ssl_certificate     /etc/ssl/certs/admin.example.com.pem;
    ssl_certificate_key /etc/ssl/private/admin.example.com.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Set `NEXTAUTH_URL` to your public HTTPS URL including the scheme:

```
NEXTAUTH_URL=https://admin.example.com
```

If you use a trusted reverse proxy for authentication (`AUTH_MODE=proxy`), ensure the app is network-isolated so that identity headers can only arrive from the proxy. See [security.md](security.md) for details.

---

## First-admin bootstrap

There is no setup wizard or separate bootstrap step. The first user to sign in via any configured auth provider is automatically granted the `ADMIN` role. Subsequent users receive the `DEVELOPER` role unless their email or domain is pre-listed in the access list.

You must configure at least one auth provider before the first sign-in. In `oidc` mode the app refuses to boot in production if no provider is configured.

---

## Health checks

The app exposes an unauthenticated liveness/readiness probe at **`GET /api/health`**. It runs a trivial `SELECT 1` against the database and returns:

- `200 {"status":"ok","db":"up"}` when the process is up and Postgres is reachable.
- `503 {"status":"degraded","db":"down"}` when the database cannot be reached.

Point your orchestrator's health check at it. Examples:

```yaml
# Docker Compose / ECS
healthcheck:
  test: ['CMD', 'wget', '-qO-', 'http://localhost:3000/api/health']
  interval: 30s
  timeout: 5s
  retries: 3
```

```nginx
# nginx upstream check (or use it as the LB target health path)
location = /healthz { proxy_pass http://127.0.0.1:3000/api/health; }
```

The endpoint is deliberately terse and leaks no connection details, so it is safe to expose to a load balancer. It does **not** require authentication (whitelisted in `src/middleware.ts`).

---

## Logging and observability

The app writes **structured JSON logs to stdout** via [pino](https://getpino.io). There is no external logging service or vendor SDK — collect stdout with whatever your platform provides (CloudWatch, Loki, Datadog, `docker logs`, etc.).

Control verbosity with `LOG_LEVEL` (`trace|debug|info|warn|error|fatal`); it defaults to `info` in production. Known secret-bearing keys (`password`, `secret`, `token`, `privateKey`, `authorization`) are redacted from log bindings.

**Change trail.** Every create/update/delete/archive of a flag, test, rollout, app, signing key, user, or access-list entry is recorded in the `activity_logs` table with the acting user's email. Admins can read it at **`GET /api/activity`** (filter by `appId`, `entityType`, `entityId`, `limit`). This is separate from the publish ledger (`audit_logs`), which records signed-config publishes.

---

## Post-deploy checklist

- [ ] `DATABASE_URL` points to production Postgres; migrations applied with `make db-migrate`
- [ ] `S3_BUCKET` / `S3_REGION` set; IAM role (or explicit keys) grants `s3:GetObject`, `s3:PutObject`, `s3:ListBucket`
- [ ] `CDN_BASE_URL` points to your CDN, not S3 directly
- [ ] CDN injects `x-bunting-signature` header from `.sig` companion file
- [ ] CDN passes ETags through unchanged
- [ ] `SIGNING_KEY_KMS_KEY_ID` (preferred) or `SIGNING_KEY_SECRET` is set; app refuses to sign without one
- [ ] `NEXTAUTH_SECRET` is a high-entropy random value (`openssl rand -hex 32`)
- [ ] `NEXTAUTH_URL` is the public HTTPS URL of the admin
- [ ] At least one auth provider is configured for `AUTH_MODE=oidc`
- [ ] OAuth redirect URI registered with your IdP: `<NEXTAUTH_URL>/api/auth/callback/<provider>`
- [ ] TLS terminated at reverse proxy; app not exposed on port 3000 directly
- [ ] Signed in once to confirm first-admin bootstrap
- [ ] Published a test config and verified SDK can fetch and verify it
- [ ] Orchestrator/LB health check points at `GET /api/health`
- [ ] Container stdout is collected by your log aggregator; `LOG_LEVEL` set as desired
