<div align="center">
  <img src="https://raw.githubusercontent.com/BenjaminBriggs/Bunting-Admin/main/public/images/Logotype.png" alt="Bunting" width="400" />
</div>

# Bunting Admin

[![Tests](https://github.com/BenjaminBriggs/Bunting-Admin/workflows/Tests/badge.svg)](https://github.com/BenjaminBriggs/Bunting-Admin/actions)
[![Build](https://github.com/BenjaminBriggs/Bunting-Admin/workflows/Build/badge.svg)](https://github.com/BenjaminBriggs/Bunting-Admin/actions)
[![License](https://img.shields.io/github/license/BenjaminBriggs/Bunting-Admin)](https://github.com/BenjaminBriggs/Bunting-Admin/blob/main/LICENSE)

> [!WARNING]
> Bunting Admin is under active development and not yet production-ready. Expect rapid iteration and occasional breaking changes.

Bunting Admin is a self-hosted feature flag dashboard for Apple platform apps. It provides environment-first flag management (development / beta / production), A/B testing, and gradual rollouts. When you publish, the admin validates, versions, and cryptographically signs a static JSON config artifact (RS256 JWS) and uploads it to S3-compatible storage; the [Bunting Swift SDK](../bunting-sdk-swift) fetches and verifies the artifact offline on-device.

---

## Features

- **Environment-first flags** — separate default values for development, beta, and production in a single flag definition
- **Flag types** — `bool`, `string`, `int`, `double`, `date` (ISO 8601), `json`
- **Rule-based targeting** — AND/OR conditions on `app_version`, `os_version`, `build_number`, `platform`, `device_model`, `region`, `locale`, and `custom_attribute`
- **A/B tests** — multi-variant experiments with configurable traffic splits
- **Gradual rollouts** — percentage-based rollouts with real-time slider controls
- **Signed publishing** — detached JWS (RS256) over exact config bytes; `kid` header supports key rotation
- **SDK bootstrap** — downloadable `BuntingConfig.plist` with endpoint URL, public keys, and fetch policy
- **Multi-app workspace** — manage multiple apps from a single instance
- **Auth** — OAuth (Google, GitHub, Microsoft) + email magic links (Resend); roles `ADMIN` / `DEVELOPER`; first sign-in becomes admin
- **Key management** — RSA key generation, rotation, and encrypted-at-rest private keys (AWS KMS or local AES-256-GCM)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19, MUI v7 |
| Language | TypeScript 5 |
| Database | PostgreSQL 13+ (local dev: 17 via Docker) |
| ORM | Prisma |
| Auth | NextAuth / Auth.js v5 — JWT sessions, 14-day expiry |
| Storage | S3 / S3-compatible (local dev: MinIO) |
| Signing | `jose` — RS256 JWS |
| Runtime | Node 24 |
| Package manager | pnpm 11 |

---

## Quick Start (Local Development)

**Prerequisites:** Node 24, pnpm 11, Docker Desktop.

```bash
# 1. Install dependencies
make install

# 2. Start PostgreSQL + MinIO + Dex OIDC, then push the Prisma schema
make setup

# 3. Start the dev server
make dev
```

Open http://localhost:3000. Sign in with the local Dex OIDC provider (`admin@bunting.dev` / `password`). The first account becomes admin automatically.

**Local service URLs**

| Service | URL | Credentials |
|---|---|---|
| Bunting Admin | http://localhost:3000 | — |
| MinIO console | http://localhost:9001 | `admin` / `admin123` |
| MinIO API | http://localhost:9000 | — |
| PostgreSQL | `localhost:5432` | `admin` / `admin123` |
| Dex OIDC | http://auth.localhost:5556/dex | `admin@bunting.dev` / `password` |
| Prisma Studio | http://localhost:5555 | run `pnpm run db:studio` |

See [docs/local-development.md](docs/local-development.md) for full details and environment notes.

---

## How It Works

1. **Author** — create flags and experiments in the dashboard; each flag stores per-environment default values and optional rule-based variants.
2. **Validate** — before publishing, the admin runs a validation pass that surfaces blocking errors and warnings.
3. **Version** — each publish increments a `YYYY-MM-DD.N` config version (N resets daily).
4. **Sign** — the config JSON is serialized once and signed with a detached JWS (RS256, `kid` header). Private keys are encrypted at rest.
5. **Publish** — `{appIdentifier}/config.json` and `{appIdentifier}/config.json.sig` are uploaded to S3/S3-compatible storage.
6. **Distribute** — operators front S3 with a CDN and inject the `x-bunting-signature` response header from the `.sig` file (see [docs/deployment.md](docs/deployment.md)).
7. **Evaluate** — the Swift SDK fetches the artifact, verifies the signature offline using embedded public keys, and evaluates flags locally. It falls back to the last-known-good cache, then to the bundled seed config.

---

## One-Click Deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BenjaminBriggs/Bunting-Admin)
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/BenjaminBriggs/Bunting-Admin)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/BenjaminBriggs/Bunting-Admin)

After deployment, open `/setup` on your domain to configure authentication and storage. See [docs/deployment.md](docs/deployment.md) and [docs/production-deployment.md](docs/production-deployment.md).

---

## Make Targets

```bash
make install          # pnpm install --frozen-lockfile
make setup            # start services + push schema
make dev              # dev server at http://localhost:3000
make build            # production build
make test             # all tests
make test-unit        # unit tests
make test-integration # integration tests (requires Postgres)
pnpm test:e2e         # Playwright e2e tests (no make target)
make lint             # ESLint
make format           # Prettier check
make type-check       # tsc --noEmit
make db-generate      # regenerate Prisma client
make db-migrate       # run migrations
make clean            # remove .next, coverage, node_modules
```

---

## Documentation

Full index: [docs/README.md](docs/README.md)

| Document | Description |
|---|---|
| [Concepts](docs/concepts.md) | Flags vs. tests vs. rollouts, environment-first model, bucketing, glossary |
| [Config Artifact Spec](docs/config-artifact-spec.md) | Canonical JSON contract consumed by the SDK |
| [Product Overview](docs/product-overview.md) | Capabilities, workflows, and dashboard tour |
| [Local Development](docs/local-development.md) | Docker setup guide |
| [Deployment](docs/deployment.md) | One-click hosting and CDN setup |
| [Production Deployment](docs/production-deployment.md) | Hardening, auth, and storage configuration |
| [Security](docs/security.md) | Auth model, key management, and signing pipeline |
| [API Reference](docs/api-reference.md) | REST endpoints and request/response shapes |
| [Testing](docs/testing.md) | Test types, coverage requirements, and commands |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and fixes |

---

## Swift SDK

The companion **[bunting-sdk-swift](../bunting-sdk-swift)** repo contains the Swift SDK and SPM codegen plugin for integrating Bunting feature flags into iOS, macOS, watchOS, and tvOS apps (iOS 18+ / macOS 15+ / watchOS 11+ / tvOS 18+).

---

## Status

Under active development. Not yet production-ready — expect rapid iteration and occasional breaking changes.

## License

[MIT](LICENSE)
