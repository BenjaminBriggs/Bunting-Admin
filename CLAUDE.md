# CLAUDE.md

Bunting Admin is the web dashboard for the Bunting feature flag system. It manages flags, A/B tests, and rollouts for Apple platform apps; publishes signed config artifacts to S3; and generates the `BuntingConfig.plist` that the Swift SDK uses to bootstrap.

**See README.md for project overview, tech stack, quick start, and docs index.**

Status: under active development, not yet production-ready.

---

## Architecture

```
src/app/
  dashboard/          # Admin UI pages (flags, tests, rollouts, releases, settings)
  api/                # Next.js API routes (apps, flags, tests, rollouts, config, bootstrap, keys, users)
src/lib/
  config-generator.ts # Transforms DB state → config artifact JSON
  config-comparison.ts # Diffs local state against published S3 config
  bucketing.ts        # Deterministic user bucketing (SHA-256 → percentage)  ⚠️ see known bugs
  changes-context.tsx # React context tracking unpublished changes
  db.ts               # Prisma client singleton
src/components/
  features/flags/     # FlagValueInput and flag-specific components
  features/rules/     # Rule builder UI
src/types/
  index.ts            # Core types; schema_version = 1
  rules.ts            # Rule/condition types
prisma/schema.prisma  # PostgreSQL schema (App, Flag, TestRollout, AuditLog, SigningKey, User, AccessList)
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

---

## Known issues

Two known gaps are documented in the human docs — read them before touching the related code:

- **32-bit bucketing** (`src/lib/bucketing.ts` uses 4 bytes; SDK uses 8) — see `../docs/concepts.md` and `../docs/codebase-overview.md`.
- **API authorization gap** (25 of 27 routes don't call `auth()`) — see `docs/security.md` → "API authorization coverage".
