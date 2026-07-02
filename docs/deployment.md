# Deployment

Bunting Admin ships with preconfigured templates so you can launch the dashboard in minutes.

## One-Click Hosting

One-click deploy to Render — the [`render.yaml`](../render.yaml) blueprint provisions a Postgres database and deploys the **container image** (the `Dockerfile`, not a buildpack). The container's entrypoint runs `prisma migrate deploy` on every boot, so the schema is created and kept in sync automatically — no separate migration step.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BenjaminBriggs/Bunting-Admin)

Authentication and storage are configured entirely through environment variables — there is no in-app setup wizard. `render.yaml` generates `NEXTAUTH_SECRET` / `SIGNING_KEY_SECRET` and wires `DATABASE_URL`, but marks the auth (`OIDC_*` or `AUTH_MODE=proxy`), storage (`S3_BUCKET`, `S3_REGION`, `CDN_BASE_URL`), and `NEXTAUTH_URL` vars as `sync: false` — Render prompts for them on first deploy, and the app refuses to boot in production until they are set. See [`.env.example`](../.env.example) and [production-deployment.md](production-deployment.md) for the full list.

> **Auto-migrate caveat:** running migrations from the container entrypoint suits a single instance (the Render starter plan). If you scale to multiple replicas, run `prisma migrate deploy` as a one-off release step instead, so concurrent boots don't race.

## Post-Deployment Checklist

1. **Configure authentication** via env vars. `AUTH_MODE` selects `oidc` (bring your own OpenID Connect IdP — the default) or `proxy` (a trusted reverse-proxy authenticates users). In `oidc` mode at least one provider must be set or the app refuses to boot.
2. **Configure object storage** (`S3_BUCKET`, `S3_REGION`, `CDN_BASE_URL`, and optionally `S3_ENDPOINT`/keys) and a signing-key protection scheme (`SIGNING_KEY_KMS_KEY_ID` or `SIGNING_KEY_SECRET`).
3. **Open the deployed URL and sign in.** On a fresh install, the first user to authenticate is granted the `ADMIN` role automatically — see [security.md](security.md) §RBAC and first-admin for the exact rule and how it differs between `oidc` and `proxy` mode.
4. **Create your first app** at `/setup/app` (the only setup step in the UI).

## OAuth Provider Guides

### Google

1. Visit the [Google Cloud Console](https://console.cloud.google.com) and select a project.
2. Create an OAuth 2.0 Client ID for a web application.
3. Add your app domain to the Authorized JavaScript origins and redirect URI (`/api/auth/callback/google`).
4. Set the Client ID and Client Secret as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### GitHub

1. Open **Settings → Developer settings → OAuth Apps**.
2. Create a new OAuth App with the callback URL `https://<your-domain>/api/auth/callback/github`.
3. Set the Client ID and Secret as `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

### Microsoft

1. In the [Azure Portal](https://portal.azure.com), open **App registrations** and create a new application.
2. Configure a web redirect URI that ends with `/api/auth/callback/azure-ad`.
3. Set the Client ID, Client Secret, and Tenant ID as `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID`.

### Email Magic Links (Resend)

1. Create an account at [Resend](https://resend.com) and generate an API key.
2. Set the key as `RESEND_API_KEY` and the sending address as `EMAIL_FROM`.

## Access Control

- On a fresh install (empty access list, no admin yet), the first user to authenticate is granted the **ADMIN** role. Once any access list entry exists, later sign-ins — including a first `oidc` sign-in on an instance a `proxy` deployment already bootstrapped — are checked against it instead. See [security.md](security.md) §RBAC and first-admin.
- Additional users start with the **DEVELOPER** role (unless their email or domain is pre-listed in the access list).
- Admins manage access and roles from the dashboard under **Settings** (the access controls are visible to ADMIN users only).

Once authentication is configured, continue setting up your first application via the dashboard. For a product tour, see `docs/product-overview.md`.

## CDN Configuration for SDK Signature Verification

The Bunting Swift SDK verifies every config fetch using a JWS signature. When you publish a config, Bunting Admin uploads two files to S3:

- `{app-identifier}/config.json` — the config artifact
- `{app-identifier}/config.json.sig` — the JWS signature string

The SDK first checks the `x-bunting-signature` response header; if it's absent, it automatically falls back to fetching `config.json.sig` as a sibling object. **A plain CDN in front of S3, with no custom logic, works correctly out of the box** — no header injection is required for signature verification to succeed. Injecting the header is an optional optimization that saves the SDK one HTTP request per config refresh. See [production-deployment.md](production-deployment.md#cdn-requirement--critical-for-signature-verification) for a working Lambda@Edge example and why CloudFront Functions can't do this (no outbound network access).

### Local Development (MinIO)

For local development, MinIO serves `config.json` and `.sig` directly without injecting the `x-bunting-signature` header. The SDK's sibling-`.sig` fallback handles this automatically — no proxy is needed to exercise verification locally, as long as both objects are reachable from the SDK.
