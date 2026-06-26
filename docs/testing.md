# Testing Guide

This project layers its automated checks so you can target the right suite for the work you are doing.

## Test Types & Locations

- **Unit tests** live under `tests/unit` and focus on pure logic (e.g. schema/crypto helpers).
- **Integration tests** sit in `tests/integration` and exercise API route handlers directly against Prisma.
- **UI tests** live in `tests/ui` and use JSDOM (via a per-file `@jest-environment jsdom` docblock) with React Testing Library. Note: `jest.config.js` only defines the `unit` and `integration` projects, so `tests/ui` is **not** picked up by `jest` / `make test` today — run such files directly (e.g. `pnpm exec jest tests/ui`) until a `ui` project is added.
- **End-to-end tests** are in `e2e` and run with Playwright against a built Next.js app.

Integration suites share `tests/setup.integration.js` for MSW, deterministic timers, and database cleanup. Pure unit suites use `tests/setup.unit.js` so they stay database-free.

## Running the Suites

```bash
# install once
make install

# fast unit suite (no database needed)
make test-unit

# integration-only (requires Postgres running)
DATABASE_URL=postgresql://admin:admin123@127.0.0.1:5432/bunting_test make test-integration

# all suites with coverage (requires Postgres running)
DATABASE_URL=postgresql://admin:admin123@127.0.0.1:5432/bunting_test pnpm run test:cov

# playwright e2e against an already-running server on :3000
NEXTAUTH_SECRET=dev-secret make test-e2e

# or build + start + run in one step (no separate server needed)
NEXTAUTH_SECRET=dev-secret pnpm run e2e
```

> **Tip:** Local Postgres is bundled in `docker-compose.yml`. Start it with `docker compose up -d postgres`, then create `bunting_test` and run `pnpm exec prisma db push` (or `pnpm run db:push`) to sync the schema. Prisma 7 reads the connection URL from `prisma.config.ts` (which loads `DATABASE_URL` via `dotenv`), so set that env var for the target database.

## Database Utilities

`tests/db-utils.ts` exposes `truncateAll()` which integration suites call after every test via `tests/setup.integration.js`. If you add tables, extend the ordered list there so suites remain isolated.

## MSW

Mock external HTTP calls by editing `tests/msw/server.ts`. Use `server.use(...)` inside tests to add scenario-specific handlers. Any unexpected outbound request fails the test (`onUnhandledRequest: 'error'`).

## Coverage Strategy

Coverage reports on all of `src/lib` (`collectCoverageFrom: ['src/lib/**/*.{ts,tsx}']` in `jest.config.js`, with `src/app` ignored). The global thresholds are a "don't regress" baseline set just below current measured coverage — branches 70%, functions 40%, lines/statements 22% — not a hard quality bar. Ratchet these up as `src/lib` coverage grows.

## E2E Flow

`make test-e2e` runs `playwright test` against a server that is already listening on port 3000 (the default Playwright config has no `webServer`). The `pnpm run e2e` script does the full cycle in one step: `e2e:build` builds the app, then `start-server-and-test` launches `next start` on port 3000 (`e2e:start`) and runs `playwright test` against it. The default config (`playwright.config.ts`) ignores `smoke-key-paths.spec.ts` and runs the remaining specs (currently `e2e/smoke.spec.ts`). Remember to run `pnpm exec playwright install` once to download browsers.

## Core-Flow Smoke Test (`make smoke`)

The smoke test is a full-stack sanity check: it stands up a **fresh** environment and drives the real authoring key paths end-to-end through the browser, then tears everything down. Use it to confirm "nothing is broken" after a dependency bump, a Next.js upgrade, an auth change, or before a release.

```bash
make smoke
```

What it does (`scripts/smoke.sh`):

1. `docker compose down -v` then `up -d --build` — a clean stack (Postgres, MinIO, **dex** OIDC, app) with an empty database.
2. Polls `GET /api/health` until the app is ready.
3. Runs the Playwright spec `e2e/smoke-key-paths.spec.ts` against `http://localhost:3000`.
4. Tears the stack down (`down -v`).

The spec exercises, in order:

- **Sign in** via the real OIDC flow against dex (`admin@bunting.dev` / `password`) — the same code path as production, no auth bypass.
- **Create the first app** through the `/setup/app` wizard (first sign-in bootstraps the `ADMIN`).
- **Create a flag of each of the six types** (`bool`, `string`, `int`, `double`, `date`, `json`) through the flag form, entering a representative default value for each.
- **Publish** a signed config (validates → signs → uploads to MinIO) and asserts the success banner.

### Flags

| Flag           | Effect                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `KEEP_STACK=1` | Leave the stack running after the test (for debugging). Tear down later with `docker compose down -v`. |
| `NO_BUILD=1`   | Skip the image rebuild (faster; only safe when dependencies are unchanged).                            |

### How it stays green

The spec selects elements by **`data-testid`** rather than copy or layout, so UI wording changes don't break it. The hooks currently in place:

| testid                                                             | Where                    | Purpose                                  |
| ------------------------------------------------------------------ | ------------------------ | ---------------------------------------- |
| `sso-signin`                                                       | `SignInForm`             | "Continue with SSO" button               |
| `app-name`, `app-identifier`, `setup-next`, `create-app`           | `/setup/app`             | app creation wizard                      |
| `new-flag`                                                         | flags list (empty state) | create-first-flag button                 |
| `flag-name`, `flag-type-<type>`, `flag-default-value`, `flag-save` | `flag-form`              | flag editor (one `flag-type-*` per type) |
| `publish-button`, `publish-success`                                | `/dashboard/publish`     | publish trigger + success banner         |

If you add a flow you want covered, add a `data-testid` to the new control and extend `e2e/smoke-key-paths.spec.ts`.

### Relationship to the CI e2e job

This spec is **not** run by the default `make test-e2e` / CI e2e job — that job builds a production app in `proxy` auth mode and only runs the lightweight `e2e/smoke.spec.ts`. The full-stack smoke needs the dex OIDC stack, so `playwright.config.ts` ignores `smoke-key-paths.spec.ts` and `make smoke` runs it via `playwright.smoke.config.ts`. It is intended to be run on demand (locally or in a dedicated job that can run Docker Compose), not on every push.

## Removing Coverage Overrides

`scripts/check-istanbul.js` prints the version of `test-exclude` bundled with `babel-plugin-istanbul`. When it reports a `^7.x` release you can drop the overrides in `package.json`, reinstall, and re-run the suites to confirm no regressions.
