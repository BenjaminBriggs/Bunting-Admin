<div align="center">
  <img src="https://raw.githubusercontent.com/BenjaminBriggs/Bunting-Admin/main/public/images/Logotype.png" alt="Bunting" width="400" />
</div>

# Bunting Admin

[![Tests](https://github.com/BenjaminBriggs/Bunting-Admin/workflows/Tests/badge.svg)](https://github.com/BenjaminBriggs/Bunting-Admin/actions)
[![Build](https://github.com/BenjaminBriggs/Bunting-Admin/workflows/Build/badge.svg)](https://github.com/BenjaminBriggs/Bunting-Admin/actions)
[![License](https://img.shields.io/github/license/BenjaminBriggs/Bunting-Admin)](https://github.com/BenjaminBriggs/Bunting-Admin/blob/main/LICENSE)

Self-hosted feature flagging for Apple platform apps, with staged rollouts, A/B testing, and a polished admin experience.

> [!WARNING]
> Bunting Admin is under active development and not yet production-ready. Expect rapid iteration and occasional breaking changes.

## Why Teams Use It

- Built for multi-app workspaces and environment-specific flag values.
- Gradual rollouts, multi-variant experiments, and reusable cohorts out of the box.
- OAuth and magic-link authentication with role-based access control.
- Simple hosting story—deploy in the cloud, or run locally with Docker.

## Quick Start

- **Deploy to the cloud**: Configure auth and storage via environment variables (see `.env.example`), then deploy. Extra detail lives in [Deployment](docs/deployment.md).
- **Run locally**: `docker compose up` for the full stack (app, Postgres, MinIO, and a local OIDC provider) — more in [Local Development](docs/local-development.md).

## One-Click Deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BenjaminBriggs/Bunting-Admin)
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/BenjaminBriggs/Bunting-Admin)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/BenjaminBriggs/Bunting-Admin)

Authentication is configured via environment variables before deploy (`AUTH_MODE` with generic OIDC or a trusted reverse-proxy; see `.env.example`). The first user to sign in becomes the admin.

## Documentation

Full documentation index: [docs/README.md](docs/README.md)

- [Concepts](docs/concepts.md) — flags vs. cohorts vs. tests vs. rollouts, the publishing pipeline, deterministic bucketing, and glossary.
- [Config Artifact Specification](docs/config-artifact-spec.md) — the canonical JSON contract consumed by the SDK.
- [Product Overview](docs/product-overview.md) — capabilities, workflows, and dashboard tour.
- [Local Development](docs/local-development.md) — Docker-powered setup guide and pnpm scripts.
- [Deployment](docs/deployment.md) — one-click hosting and post-deploy checklist.
- [Production Deployment](docs/production-deployment.md) — hardening, auth, and storage configuration.
- [Security](docs/security.md) — auth model, key management, and signing pipeline.
- [API Reference](docs/api-reference.md) — REST endpoints and request/response shapes.
- [Testing](docs/testing.md) — required coverage, test types, and commands.
- [Troubleshooting](docs/troubleshooting.md) — quick fixes for common issues.

The companion `bunting-sdk-swift` repo (<SDK repo URL TBD>) contains the Swift SDK and SPM codegen plugin for integrating feature flags in your Apple platform apps.

## Contributing

Contributions across docs, UI, and platform integrations are welcome. Open an issue to propose features or pick up an existing one.

## License

This project is available under the [MIT License](LICENSE).
