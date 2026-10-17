# Contributing

Contributions to Bunting Admin are welcome — bug fixes, docs, tests, and new features. This guide covers the admin web app. SDK contributions live in `bunting-sdk-swift`.

## Dev setup

You need Node.js 24, Docker Desktop, and pnpm 11.

```bash
cd bunting-admin

# Install dependencies
make install        # pnpm install --frozen-lockfile

# Start Postgres, MinIO, Dex OIDC, and push the schema
make setup

# Start the dev server
make dev
```

Open http://localhost:3000. Sign in with `admin@bunting.dev` / `password` (Dex local account).

Local services:

| Service       | URL                            |
| ------------- | ------------------------------ |
| Admin UI      | http://localhost:3000          |
| Postgres      | localhost:5432                 |
| MinIO API     | http://localhost:9000          |
| MinIO Console | http://localhost:9001          |
| Dex OIDC      | http://auth.localhost:5556/dex |

See [docs/local-development.md](bunting-admin/docs/local-development.md) for full detail.

## Code style

- TypeScript everywhere. `make type-check` must pass.
- Lint with `make lint` (ESLint + Next.js config).
- Prettier is configured via `@guardian/prettier` — run `make format` before committing.
- Match the file's existing comment density and naming idiom.

## Test / typecheck gate

Every PR must pass:

```bash
make lint && make type-check && make test
```

The test command runs `jest` across unit, integration, and UI suites. Integration tests require Postgres:

```bash
DATABASE_URL=postgresql://admin:admin123@127.0.0.1:5432/bunting_test make test
```

See [docs/testing.md](bunting-admin/docs/testing.md) for full details on suites, coverage, and Playwright e2e.

## PR process

1. Open an issue first for non-trivial changes — alignment saves rework.
2. Branch from `main`, keep PRs focused.
3. All tests pass; no type errors; lint clean.
4. Update the relevant docs under `bunting-admin/docs/` if you change behaviour.
5. Write a PR title and description that work as release notes: releases are published with GitHub's generated notes.

## Releasing

1. Set `version` in `package.json` to the new version and merge it to `main`.
2. Tag that commit and push the tag: `git tag v1.2.3 && git push origin v1.2.3`.

The `Release` workflow checks the tag matches `package.json`, runs the production smoke, then publishes the multi-arch image to GHCR and a GitHub release with the deploy bundle. A tag with a suffix (`v1.2.3-rc.1`) is published as a pre-release with only its exact image tag.

Deployments can skip versions, which only works if migration history is append-only: never edit, squash or delete a migration that has been released. Breaking changes to environment variables or the deploy bundle need a major version and upgrade notes in the release.

## Where docs live

Docs follow a rough [Diátaxis](https://diataxis.fr) layout inside `bunting-admin/docs/`:

| File                       | Type               | Audience                 |
| -------------------------- | ------------------ | ------------------------ |
| `local-development.md`     | Tutorial           | New contributors         |
| `production-deployment.md` | How-to             | Operators                |
| `security.md`              | Reference + how-to | Operators                |
| `testing.md`               | Reference          | Contributors             |
| `troubleshooting.md`       | How-to             | Operators + contributors |
| `deployment.md`            | How-to             | Operators                |

`CONTRIBUTING.md` applies to the whole repository.
