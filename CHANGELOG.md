# Changelog

All notable changes to Bunting Admin are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Bunting Admin does not yet follow semantic versioning — releases are date-tagged during the pre-1.0 phase.

> Bunting Admin is under active development and not yet production-ready.

---

## [Unreleased]

### Added

- **Auth system** — NextAuth v5 with `AUTH_MODE` selecting between generic OIDC (Okta, Auth0, Keycloak, Google Workspace, etc.) and trusted reverse-proxy / IAP mode. Named OAuth providers (Google, GitHub, Microsoft) and email magic links (Resend) available as additional sign-in options.
- **RBAC** — `ADMIN` and `DEVELOPER` roles. First user to sign in is automatically promoted to admin. Access list supports per-email and per-domain role assignment.
- **Signing-key encryption at rest** — Private keys stored encrypted in Postgres using either AWS KMS (`SIGNING_KEY_KMS_KEY_ID`) or local AES-256-GCM (`SIGNING_KEY_SECRET`). Legacy plaintext rows accepted transparently.
- **Detached JWS signing** — Publish pipeline signs the exact bytes of `config.json` with RS256 and uploads a companion `config.json.sig` for SDK signature verification.
- **Multi-environment flags** — Flags carry independent default values and conditional variants per environment (development / beta / production).
- **A/B tests** — Multi-variant tests with traffic percentage splitting and per-variant flag value overrides.
- **Gradual rollouts** — Percentage-based rollouts with interactive sliders and real-time updates.
- **Publishing pipeline** — Change tracking, validation (blocking errors + warnings), versioned config uploads (`YYYY-MM-DD.N`), and audit log.
- **S3 / S3-compatible storage** — Single global bucket model with CDN base URL derivation. IAM role credentials used in production; explicit keys for local MinIO.
- **SDK bootstrap plist** — Downloadable `BuntingConfig.plist` per app with CDN URL, public keys, and fetch policy for the Swift SDK.
- **Docker Compose dev stack** — Postgres 17, MinIO, Dex OIDC container, and the app with hot reload. `npm run docker:up` starts everything.
- **Prisma schema** — `App`, `Flag`, `TestRollout`, `AuditLog`, `SigningKey`, `Publication`, `User`, `AccessList`.
- **Test suite** — Unit, integration, UI, and Playwright e2e layers. Jest with `--selectProjects` for targeted runs.
- **Operator docs** — `docs/production-deployment.md`, `docs/security.md`, `docs/testing.md`, `docs/troubleshooting.md`.

### Known gaps (pre-1.0)

- No rate limiting built in — apply at the reverse proxy.
- No audit-log retention policy — prune the `audit_logs` and `publications` tables externally.
- A/B test statistical analysis uses mock data pending real analytics integration.
- No CDN layer is bundled — operators must front S3 with a CDN and inject `x-bunting-signature` headers.
