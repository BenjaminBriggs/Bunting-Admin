# Testing Guide

This project layers its automated checks so you can target the right suite for the work you are doing.

## Test Types & Locations
- **Unit tests** live under `tests/unit` and focus on pure logic (e.g. schema/crypto helpers).
- **Integration tests** sit in `tests/integration` and exercise API route handlers directly against Prisma.
- **UI tests** live in `tests/ui` and run in JSDOM with React Testing Library.
- **End-to-end tests** are in `e2e` and run with Playwright against a built Next.js app.

Integration suites share `tests/setup.integration.js` for MSW, deterministic timers, and database cleanup. Pure unit suites use `tests/setup.unit.js` so they stay database-free.

## Running the Suites
```bash
# install once
npm install

# fast unit suite (no database needed)
npm run test -- --selectProjects unit

# integration-only (requires Postgres running)
DATABASE_URL=postgresql://admin:admin123@127.0.0.1:5432/bunting_test npm run test -- --selectProjects integration

# unit + integration + ui with coverage (requires Postgres running)
DATABASE_URL=postgresql://admin:admin123@127.0.0.1:5432/bunting_test npm run test:cov

# smoke integration only
DATABASE_URL=... npm run test:integration

# playwright smoke (build + run)
NEXTAUTH_SECRET=dev-secret npm run e2e:build
NEXTAUTH_SECRET=dev-secret npm run e2e
```

> **Tip:** Local Postgres is bundled in `docker-compose.yml`. Start it with `docker compose up -d postgres`, then create `bunting_test` and run `npx prisma db push` to sync the schema.

## Database Utilities
`tests/db-utils.ts` exposes `truncateAll()` which integration suites call after every test via `tests/setup.integration.js`. If you add tables, extend the ordered list there so suites remain isolated.

## MSW
Mock external HTTP calls by editing `tests/msw/server.ts`. Use `server.use(...)` inside tests to add scenario-specific handlers. Any unexpected outbound request fails the test (`onUnhandledRequest: 'error'`).

## Coverage Strategy
Coverage is currently scoped to `src/lib/db.ts` while we stabilise the suite. Each time you add meaningful tests to a module, widen `collectCoverageFrom` (and optionally `coverageThreshold`) in `jest.config.js`. Keep the global 90% bar when you expand the scope.

## E2E Flow
CI runs `npm run e2e` in a dedicated job. The script builds the app, launches `next start` on port 3000 via `start-server-and-test`, and executes Playwright smoke specs. Locally you can reuse the same scripts; remember to run `npx playwright install` once to download browsers.

## Removing Coverage Overrides
`scripts/check-istanbul.js` prints the version of `test-exclude` bundled with `babel-plugin-istanbul`. When it reports a `^7.x` release you can drop the overrides in `package.json`, reinstall, and re-run the suites to confirm no regressions.
