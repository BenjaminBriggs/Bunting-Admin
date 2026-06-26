# CLAUDE.md

Bunting Admin is the web dashboard for the Bunting feature flag system. It manages flags, A/B tests, and rollouts for Apple platform apps; publishes signed config artifacts to S3; and generates the `BuntingConfig.plist` that the Swift SDK uses to bootstrap.

**See README.md for project overview, tech stack, quick start, and docs index.**

Status: under active development, not yet production-ready.

---

## Architecture

```
src/app/
  dashboard/          # Admin UI pages (flags, tests, rollouts, releases, settings)
  api/                # Next.js API routes (apps, flags, tests, rollouts, config, bootstrap, keys, users, access-list, activity, health)
src/lib/
  config-generator.ts # Transforms DB state → config artifact JSON
  config-comparison.ts # Diffs local state against published S3 config
  bucketing.ts        # Deterministic user bucketing (SHA-256 → percentage; 64-bit big-endian, matches the SDK)
  changes-context.tsx # React context tracking unpublished changes
  authz.ts            # requireAdmin / getRequestRole (per-route authorization)
  activity-log.ts     # Best-effort change trail (logActivity) → activity_logs
  logger.ts           # Structured pino logger (server-only; LOG_LEVEL)
  db.ts               # Prisma 7 client singleton (pg driver adapter)
src/components/
  features/flags/     # FlagValueInput and flag-specific components
  features/rules/     # Rule builder UI
src/types/
  index.ts            # Core types; schema_version = 1
  rules.ts            # Rule/condition types
prisma/schema.prisma  # PostgreSQL schema (App, Flag, TestRollout, AuditLog, ActivityLog, SigningKey, User, AccessList, Rule, Publication)
```

Key relationships: every `Flag` and `TestRollout` belongs to an `App`. Flags store `defaultValues` and `variants` as JSON keyed by environment (`development`, `beta`, `production`). `TestRollout` covers both A/B tests (`type = TEST`) and rollouts (`type = ROLLOUT`).

---

## Dev Commands

```bash
make install          # pnpm install --frozen-lockfile
make setup            # docker compose up + prisma db push
make dev              # next dev (http://localhost:3000)
make build            # next build
make test             # jest (all)
make test-unit        # jest tests/unit
make test-integration # jest --selectProjects integration
pnpm test:e2e         # playwright e2e tests (no make target)
make smoke            # full-stack core-flow smoke (fresh docker stack; on demand, not in CI)
make lint             # eslint
make type-check       # tsc --noEmit
make db-migrate       # prisma migrate dev
make db-generate      # prisma generate
pnpm run db:studio    # Prisma Studio at http://localhost:5555
```

Tests must pass and `make build` must succeed before committing.

---

## Canonical facts

The single source of truth for environments, flag types, versioning, the publish/signing pipeline, the bootstrap plist, auth, and the stack is the human documentation — do not restate or duplicate it here (that is how docs drift):

- `README.md` — overview, tech stack, quick start
- `docs/` (this repo) — admin operational detail (concepts, config-artifact-spec, security, deployment, api-reference)
- `../docs/` (Bunting root) — cross-cutting system docs (see `../docs/README.md`)

---

## Conventions

- Flag keys are normalized to `namespace/snake_case` (e.g. `"Store: New Paywall"` → `"store/new_paywall"`). Keys are unique per app.
- Prisma returns flag `type` as uppercase (`BOOL`); the wire format and config artifact use lowercase (`bool`). Handle both.
- API routes under `src/app/api/` use Zod for request validation. Error envelope: `{ "error": "string" }` with optional `"details"` for Zod failures.
- `src/app/api/config/publish` serializes the config JSON exactly once before signing — do not reserialize after signing or the signature will be invalid.
- The `/api/test-rollouts` routes are the primary frontend interface; `/api/tests` and `/api/rollouts` apply type filters and are secondary.
- Edge-safety: modules reachable from `src/middleware.ts` (the auth chain — `auth`, `auth-session`, `access-control`) must NOT statically import `@/lib/db` or `@/lib/logger`; they pull Node-only deps (`pg`, `pino`) into the edge bundle and crash it. Import them lazily via dynamic `import()` (see `access-control.ts` `getDb`). Enforced by ESLint `no-restricted-imports`.
- Server-only modules (`db`, `jws-signer`, `key-protection`, `crypto`) carry `import 'server-only'` so the build fails if they leak into a client bundle. Use the pino logger (`@/lib/logger`) in server code; `console.*` is lint-banned in `src/lib` + `src/app/api` (except the edge files).

---

## Authentication & authorization

- **Authentication** is enforced globally in `src/middleware.ts` (edge); unauthenticated requests never reach a handler.
- **Authorization** is enforced per-route via `requireAdmin` (`src/lib/authz.ts`) in node-runtime handlers — the role comes from the NextAuth session (oidc) or the access list (proxy). ADMIN-only: publish, keys, users, access-list, activity, crypto/test. Flags/tests/rollouts/apps are open to any authenticated user. See `docs/security.md` → "API authorization coverage" and `../docs/authentication.md` §Roles.
