# Product Overview

Bunting Admin is a feature flag dashboard tailored for Apple platform apps, with first-class support for multi-app environments and staged rollouts.

## Core Capabilities

- **Environment-first flags**: Maintain separate values for development, beta, and production.
- **Type-safe variants**: Supports `bool`, `string`, `int`, `double`, `date`, and `json` payloads.
- **Rule-based overrides**: Target users with AND/OR logic and environment awareness.
- **Gradual rollouts**: Control rollout percentages in real time for any flag or experiment.
- **Multi-app workspace**: Manage multiple applications from a single interface with quick context switching.
- **Secure auth**: Generic OIDC, OAuth (Google, GitHub, Microsoft), email magic links, or a trusted reverse proxy, plus role-based access control (ADMIN / DEVELOPER).

## Typical Workflow (iOS/macOS)

1. Deploy Bunting Admin (see `docs/deployment.md`), configuring authentication via environment variables; the first user to sign in becomes the admin.
2. Create an application entry for your iOS or macOS app under **Settings → Applications**.
3. Define feature flags with environment-specific defaults and optional targeting rules.
4. Publish changes to generate a signed configuration bundle.
5. Integrate the bundle with the Bunting SDK in your Apple app for runtime evaluation.
6. Launch experiments or progressive rollouts and monitor results.

## Dashboard Tour

- **Feature Flags**: Create, edit, and audit flags with support for conditional variants.
- **A/B Tests**: Configure multi-variant experiments and manage their lifecycle (draft → running → complete/archive).
- **Rollouts**: Gradually expose features with precise traffic percentages.
- **Releases**: Review pending changes, validate configuration, and publish to storage.
- **Settings**: Manage apps, environment credentials, team members, and SDK integration details.

Need help integrating the SDK? Check the companion repositories in the root of this project for platform-specific clients.
