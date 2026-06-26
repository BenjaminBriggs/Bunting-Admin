# Deployment

Bunting Admin ships with preconfigured templates so you can launch the dashboard in minutes.

## One-Click Hosting

One-click deploy to Render — it clones this repo and wires the defaults for you:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BenjaminBriggs/Bunting-Admin)

Authentication and storage are configured entirely through environment variables — there is no in-app setup wizard. Set them on your hosting platform before the first boot; see [`.env.example`](../.env.example) and [production-deployment.md](production-deployment.md) for the full list.

## Post-Deployment Checklist

1. **Configure authentication** via env vars. `AUTH_MODE` selects `oidc` (bring your own OpenID Connect IdP — the default) or `proxy` (a trusted reverse-proxy authenticates users). In `oidc` mode at least one provider must be set or the app refuses to boot.
2. **Configure object storage** (`S3_BUCKET`, `S3_REGION`, `CDN_BASE_URL`, and optionally `S3_ENDPOINT`/keys) and a signing-key protection scheme (`SIGNING_KEY_KMS_KEY_ID` or `SIGNING_KEY_SECRET`).
3. **Open the deployed URL and sign in.** The first user to sign in is granted the `ADMIN` role automatically.
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

- The first user to sign in is granted the **ADMIN** role.
- Additional users start with the **DEVELOPER** role (unless their email or domain is pre-listed in the access list).
- Admins manage access and roles from the dashboard under **Settings** (the access controls are visible to ADMIN users only).

Once authentication is configured, continue setting up your first application via the dashboard. For a product tour, see `docs/product-overview.md`.

## CDN Configuration for SDK Signature Verification

The Bunting Swift SDK verifies config integrity by reading a `x-bunting-signature` HTTP response header containing the JWS-signed config. When you publish a config, Bunting Admin uploads two files to S3:

- `{app-identifier}/config.json` — the config artifact
- `{app-identifier}/config.json.sig` — the JWS signature string

**You must configure your CDN to set the `x-bunting-signature` response header** from the contents of the companion `.sig` file on every `config.json` response. Without this, every SDK fetch will fail signature verification and fall back to cached config.

### CloudFront Example

Use a CloudFront Function or Lambda@Edge to:

1. Fetch `config.json.sig` from S3 (or cache it alongside `config.json`)
2. Set the `x-bunting-signature` response header to its contents

### Local Development (MinIO)

For local development, MinIO serves the config and `.sig` objects directly without injecting the `x-bunting-signature` header, so SDK signature verification will not pass against a raw MinIO origin. To exercise verification locally, front MinIO with a thin proxy that fetches both files and merges the signature into the response header.

> **Note:** Until CDN header injection is configured, SDK clients will fail signature verification on every config fetch. They will fall back to cached config if available, or to the bundled seed config.
