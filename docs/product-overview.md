# Product Overview

Bunting Admin is a feature flag dashboard tailored for Apple platform apps, with first-class support for multi-app environments and staged rollouts.

## Core Capabilities

- **Environment-first flags**: Maintain separate values for development, staging, and production.
- **Type-safe variants**: Supports boolean, numeric, string, date, and JSON payloads.
- **Rule-based overrides**: Target cohorts with AND/OR logic and environment awareness.
- **Gradual rollouts**: Control rollout percentages in real time for any flag or experiment.
- **Multi-app workspace**: Manage multiple applications from a single interface with quick context switching.
- **Secure auth**: OAuth (Google, GitHub, Microsoft) and email magic links plus role-based access control.

## Typical Workflow (iOS/macOS)

1. Deploy Bunting Admin (see `docs/deployment.md`) and finish the setup wizard.
2. Create an application entry for your iOS or macOS app under **Settings → Applications**.
3. Define feature flags with environment-specific defaults and optional targeting rules.
4. Publish changes to generate a signed configuration bundle.
5. Integrate the bundle with the Bunting SDK in your Apple app for runtime evaluation.
6. Launch experiments or progressive rollouts and monitor results.

## Dashboard Tour

- **Feature Flags**: Create, edit, and audit flags with support for conditional variants.
- **A/B Tests**: Configure multi-variant experiments and manage their lifecycle (draft → running → complete/archive).
- **Rollouts**: Gradually expose features with precise traffic percentages.
- **Cohorts**: Build reusable targeting rules for segments like app version, locale, or subscription tier.
- **Releases**: Review pending changes, validate configuration, and publish to storage.
- **Settings**: Manage apps, environment credentials, team members, and SDK integration details.

Need help integrating the SDK? Check the companion repositories in the root of this project for platform-specific clients.
