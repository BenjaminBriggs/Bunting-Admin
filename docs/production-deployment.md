# Production Deployment

This guide covers deploying Bunting Admin beyond the one-click platforms documented in [deployment.md](deployment.md). Read [local-development.md](local-development.md) first to understand the service topology.

All environment variables are documented in [`.env.example`](../.env.example) — that file is the canonical reference. This guide explains the _why_ behind the choices.

---

## Container image

The `Dockerfile` produces a minimal, non-root production image via a multi-stage build:

```
docker build --target runner -t bunting-admin:latest .
```

The image listens on `$PORT` (defaulting to `3000`). At startup it expects all required env vars to be present — it does not fall back to defaults for secrets. Its entrypoint runs `prisma migrate deploy` before starting the server, so the schema is applied automatically on boot (see the migration note below).

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

The container applies migrations itself on startup (`prisma migrate deploy` via its entrypoint), so no separate migration step is needed for a single instance. If you run **multiple replicas**, disable that by overriding the entrypoint/command to `node server.js` and run migrations as a one-off release step instead, so concurrent boots don't race:

```bash
DATABASE_URL="..." pnpm run db:deploy   # prisma migrate deploy
```

---

## Database

### Managed Postgres (RDS, Aurora, Neon, Supabase)

Set `DATABASE_URL` to the connection string provided by your provider. Bunting Admin uses Prisma — the database must be PostgreSQL 13+.

```
DATABASE_URL="postgresql://user:pass@host:5432/bunting_admin?sslmode=require"
```

Add `?sslmode=require` for hosted providers that enforce TLS. Aurora Serverless v2 and Neon work without any additional config.

**Migrations in production:** use `prisma migrate deploy` (not `db push`, and not `make db-migrate`, which runs the interactive `prisma migrate dev`) so changes are tracked:

```bash
pnpm run db:deploy
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

**The SDK does not fetch artifacts directly from S3. You must front S3 with a CDN** (for TLS, caching, and a stable public hostname).

The Swift SDK verifies every config fetch using a detached JWS signature, published as a companion file (`config.json.sig`) alongside `config.json`.

**Default path (recommended, zero CDN logic):** the SDK checks the `x-bunting-signature` response header first; if it's absent, it automatically falls back to fetching `config.json.sig` as a sibling object next to `config.json`. A plain CDN in front of S3 — passing both objects through unmodified, with no header injection or custom logic — works correctly out of the box, as long as `config.json.sig` is readable at the same path prefix as `config.json`. The header is purely a one-request optimization; skipping it does not affect correctness or security, only latency (one extra HTTP round trip per config refresh).

**Optional optimization:** a CDN that injects the `x-bunting-signature` header saves that extra request. Doing so requires compute at the edge, because the CDN has to make a second fetch (for `.sig`) and merge it into the first response — a plain caching CDN can't do this, and **CloudFront Functions can't either**: they run in a restricted JS runtime with no network access, so they cannot fetch the sibling `.sig` object. Lambda@Edge (or an equivalent edge-compute product on another CDN) is required.

**ETag / caching:** S3 sets an ETag on each object. The CDN must pass it through unchanged — the SDK uses conditional `If-None-Match` fetches. Do not strip or rewrite ETags.

Recommended `Cache-Control` for the CDN: `max-age=300, stale-while-revalidate=86400`.

#### Lambda@Edge example (optional header injection)

An `origin-response` Lambda@Edge function that reads the sibling `.sig` object from S3 and sets the header:

```javascript
// origin-response Lambda@Edge function (Node.js 20.x runtime; @aws-sdk/client-s3 is preinstalled)
// Lambda@Edge does not support environment variables — bake the bucket name in at deploy time.
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = 'bunting-configs'; // <-- your S3 bucket name
const s3 = new S3Client({ region: 'us-east-1' }); // <-- must match your bucket's region

exports.handler = async (event) => {
	const { request, response } = event.Records[0].cf;

	if (response.status !== '200' || !request.uri.endsWith('/config.json')) {
		return response;
	}

	try {
		const sigKey = request.uri.slice(1) + '.sig'; // strip leading '/' for the S3 key
		const sigObj = await s3.send(
			new GetObjectCommand({ Bucket: BUCKET, Key: sigKey }),
		);
		const signature = await sigObj.Body.transformToString();
		response.headers['x-bunting-signature'] = [
			{ key: 'X-Bunting-Signature', value: signature },
		];
	} catch (err) {
		// Fail open — the SDK falls back to fetching the .sig sibling itself.
		console.error('Failed to inject signature header:', err);
	}

	return response;
};
```

Caveats:

- Lambda@Edge functions must be authored and deployed in `us-east-1` regardless of which region your S3 bucket or CloudFront distribution use; CloudFront replicates them to edge locations for you.
- The function's execution role needs `s3:GetObject` on `arn:aws:s3:::<bucket>/*.sig` (or a narrower prefix matching your artifact layout).
- Attach it to the **origin-response** event (not viewer-response) so it only runs on cache misses, not every viewer request.
- This is strictly an optimization. If it's misconfigured or the `.sig` fetch fails, the function fails open and the SDK's own sibling-`.sig` fallback still verifies the config correctly — it just costs one extra request.

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

## Single-instance assumptions

Two behaviors described elsewhere in this guide are only correct when you run exactly one instance of the app. If you scale to multiple replicas, both need explicit handling:

- **Rate limiting is per-instance and in-memory** (`src/lib/rate-limit.ts`). Each Node/edge isolate keeps its own counters, so N instances behind a load balancer give you an effective limit of N× the configured value, not the configured value. Counters also reset on every restart/redeploy. If you need a strict global limit, put a shared store (e.g. Redis) behind the rate limiter or enforce limits at a layer that sees all traffic (reverse proxy, API gateway).
- **Migrations run automatically on container boot** via `prisma migrate deploy` in the entrypoint (see [Container image](#container-image) and [Docker Compose (production)](#docker-compose-production) above). This is safe with a single instance, but with multiple replicas booting concurrently, two containers can race to apply the same migration. Disable the auto-migration entrypoint for multi-replica deployments and run `pnpm run db:deploy` as a one-off job before rolling out new instances instead.

If you're running a single instance, both defaults are fine as-is.

---

## Post-deploy checklist

- [ ] `DATABASE_URL` points to production Postgres; migrations applied with `pnpm run db:deploy` (`prisma migrate deploy`)
- [ ] `S3_BUCKET` / `S3_REGION` set; IAM role (or explicit keys) grants `s3:GetObject`, `s3:PutObject`, `s3:ListBucket`
- [ ] `CDN_BASE_URL` points to your CDN, not S3 directly
- [ ] `config.json.sig` is reachable at the same path prefix as `config.json` (required — the SDK falls back to fetching it directly when the header below is absent)
- [ ] (optional optimization) CDN injects `x-bunting-signature` header from `.sig` companion file — see [CDN requirement](#cdn-requirement--critical-for-signature-verification) above; a plain CDN works fine without this
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
