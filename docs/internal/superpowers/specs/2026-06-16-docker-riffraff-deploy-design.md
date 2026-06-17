# Docker-first local + riff-raff/Fargate deploy — Design

**Date:** 2026-06-16
**Status:** Approved design, pre-implementation
**Related:** Production-Readiness Plan (`~/.claude/plans/can-you-take-a-encapsulated-cocke.md`)

## Context

`bunting-admin` (Next.js 15, App Router, Prisma/Postgres, S3 publishing) currently runs locally as host-side `npm run dev` with `docker-compose.yml` providing only Postgres + MinIO + pgAdmin. There is no `Dockerfile` and no production deployment path; the repo carries several unused one-click-deploy configs (`Procfile`, `app.json`, `railway.json`, `render.yaml`, `vercel.json`).

We want two things:

1. **`docker compose up` gives a complete local debug environment** — the app itself containerized alongside its dependencies, with hot reload.
2. **A simple production deploy via Guardian riff-raff** onto AWS, where the _same Docker image_ runs in production.

### Agreed constraints

- **Tenancy:** single internal team (per-app authorization isolation is out of scope — see readiness plan).
- **Hosting:** riff-raff → AWS, **greenfield** (no AWS resources exist yet).
- **Runtime:** **ECS Fargate**, 2 tasks across 2 AZs for high availability, low traffic. ~$80–110/mo, dominated by fixed RDS + ALB cost.

## Goals / Non-goals

**Goals**

- One multi-stage `Dockerfile` serving both local dev and production.
- `docker compose up` → working admin at `localhost:3000` with DB + S3, no host Node required.
- Infra-as-code (CloudFormation) for the greenfield AWS stack riff-raff applies.
- A minimal CI → ECR → riff-raff `cloud-formation` deploy flow.
- Secrets sourced from AWS SSM, never baked into the image.

**Non-goals**

- Per-app authorization / multi-tenant isolation.
- Migrating the security/correctness fixes from the readiness plan (tracked separately; this spec only _enables_ and _cross-references_ them).
- Autoscaling beyond a fixed 2-task HA baseline.

## Design

### A. One `Dockerfile`, two targets

Multi-stage `Dockerfile` on `node:24-alpine` (matches `engines: ">=24 <25"`):

- **`deps`** — `npm ci` from `package*.json`.
- **`dev`** (target) — from `deps`, source bind-mounted at runtime; `CMD ["npm","run","dev"]`. Used by compose for hot reload.
- **`build`** — from `deps`, copy source, `npx prisma generate`, `npm run build`. Requires **`output: 'standalone'`** added to `next.config.js`.
- **`runner`** (target) — from a clean `node:24-alpine`; copy `.next/standalone`, `.next/static`, `public`, and the generated Prisma client + query-engine binary (`node_modules/.prisma`, `node_modules/@prisma/client`) and `prisma/schema.prisma`. Run as a non-root user. `CMD ["node","server.js"]`. This is the image pushed to ECR.

The same file builds both, so local and prod cannot drift.

**Standalone + Prisma note:** Next's standalone tracer does not reliably include the Prisma engine; the `runner` stage explicitly copies `.prisma`/`@prisma/client`. The `runner` image does **not** include the Prisma CLI — migrations run from the `build` stage image (which has dev deps) via `npx prisma migrate deploy` (see §E).

### B. Local: app joins the existing compose

Add an `app` service to `docker-compose.yml`:

- `build: { context: ., target: dev }`
- `depends_on`: `postgres` (`service_healthy`) and `minio-init` (`service_completed_successfully`)
- `ports: ["3000:3000"]`
- Bind mounts `./src` and `./prisma`; an anonymous/named volume guards `/app/node_modules` and `/app/.next` from being clobbered by the bind mount.
- `command`: `sh -c "npx prisma db push && npm run dev"` (uses `db push` locally until migrations are baselined — a readiness-plan P1 item).
- Env points at the compose services:
  - `DATABASE_URL=postgresql://admin:admin123@postgres:5432/bunting_admin`
  - `S3_ENDPOINT=http://minio:9000`, `S3_ACCESS_KEY_ID=admin`, `S3_SECRET_ACCESS_KEY=admin123`, `S3_BUCKET=bunting-configs`, `S3_REGION=us-east-1`
  - `NEXTAUTH_URL=http://localhost:3000`, `NEXTAUTH_SECRET=<dev value>`, `NODE_ENV=development`

`docker compose up` → app + Postgres + MinIO + pgAdmin, hot-reloading on host edits.

A separate `docker-compose.prod.yml` overrides `app` to `target: runner` for smoke-testing the exact production image locally (no bind mount, no hot reload).

### C. Production AWS stack (CloudFormation, greenfield)

One template, deliberately minimal for an internal low-traffic/HA tool:

- **Networking:** 2 **public** subnets across 2 AZs. No NAT gateway (saves ~$32/mo); tasks reach S3/ECR via gateway/interface VPC endpoints or public IP + locked-down security groups.
- **ALB** → target group health-checked at **`/api/health`** → **ECS Fargate service, desiredCount 2** running the ECR image (0.5 vCPU / 1 GB per task).
- **RDS Postgres**, **Multi-AZ**, `t4g.micro`.
- **S3 bucket** for published configs; **ECR repo**; **KMS key** for envelope-encrypting signing keys (readiness plan P0 #2).
- **IAM task role** scoped to S3 put (config bucket), KMS decrypt (signing key), SSM read (its own params).
- **Image tag** is a stack parameter, so a deploy = stack update with a new tag.

### D. riff-raff flow

GitHub Actions on merge to default branch:

1. Build the `runner` image, tag with the CI build number, **push to ECR** (auth via AWS OIDC role).
2. Upload a riff-raff artifact (`riff-raff.yaml` + CFN template) via `guardian/actions-riff-raff`.

`riff-raff.yaml`: a single **`cloud-formation`** deployment that updates the stack, passing the new image tag → ECS rolling replace of the 2 tasks. (Exact riff-raff field names — stack/region/`templatePath`/parameter mapping — finalized in implementation against the target account.)

### E. Migrations

`prisma migrate deploy` runs as a **one-off pre-deploy Fargate task** (using the `build`-stage image that carries the Prisma CLI), invoked before the service update. Running it as a discrete step — rather than on container start across both tasks — avoids a migration race between the 2 running tasks. Prerequisite: baseline an initial migration and commit `prisma/migrations/` (readiness plan P1 #9).

### F. Cleanup

Remove now-dead deploy configs once Docker/riff-raff is the standard: `Procfile`, `app.json`, `railway.json`, `render.yaml`, `vercel.json`. (Optional, low risk.)

## Files touched

| File                                                                 | Change                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Dockerfile`                                                         | New — multi-stage `deps`/`dev`/`build`/`runner`.                                                |
| `.dockerignore`                                                      | New — exclude `node_modules`, `.next`, `.git`, `coverage`, `.env*`.                             |
| `next.config.js`                                                     | Add `output: 'standalone'`.                                                                     |
| `docker-compose.yml`                                                 | Add `app` service (dev target).                                                                 |
| `docker-compose.prod.yml`                                            | New — `app` override to `runner` for local prod-image smoke test.                               |
| `src/app/api/health/route.ts`                                        | New — DB + S3 reachability check for the ALB (readiness plan, promoted to a deploy dependency). |
| `deploy/cfn.yaml` (or similar)                                       | New — CloudFormation: VPC subnets, ALB, ECS/Fargate, RDS, S3, ECR, KMS, IAM, SSM refs.          |
| `riff-raff.yaml`                                                     | New — `cloud-formation` deployment.                                                             |
| `.github/workflows/deploy.yml`                                       | New — build → ECR → riff-raff artifact upload.                                                  |
| `docs/deployment.md`                                                 | Update — replace one-click hosts with Docker + riff-raff instructions.                          |
| `Procfile`, `app.json`, `railway.json`, `render.yaml`, `vercel.json` | Remove (optional).                                                                              |

## Risks / open items

- **Prisma in standalone image** — must verify the engine binary is present and `node server.js` can reach the DB; covered by a local `docker-compose.prod.yml` smoke test before first deploy.
- **riff-raff specifics** — exact `riff-raff.yaml` schema, stack/region names, and the OIDC role ARN depend on the target AWS account, which doesn't exist yet. Implementation will leave these as clearly-marked parameters.
- **VPC endpoints vs public IP** — NAT-free networking needs S3/ECR endpoints; if simpler, tasks can run with public IPs behind security groups. Decide at implementation.
- **Migration task wiring** — riff-raff invoking a one-off Fargate task is an extra deployment step; if it proves fiddly, fall back to an advisory-lock-guarded migrate on startup.

## Verification

- **Local:** `docker compose up` → `localhost:3000` loads, can create an app/flag, publish writes to MinIO; editing a file in `src/` hot-reloads.
- **Prod image:** `docker compose -f docker-compose.yml -f docker-compose.prod.yml up` runs the `runner` image against local Postgres/MinIO and serves successfully (proves standalone + Prisma).
- **Health:** `/api/health` returns 200 only when DB + S3 are reachable, non-200 otherwise.
- **CI:** workflow builds the image and pushes to ECR; riff-raff artifact uploads.
- **Deploy (when AWS account exists):** riff-raff applies the stack; migration task runs `migrate deploy`; ALB shows 2 healthy targets; admin reachable over HTTPS.
