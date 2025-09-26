# Deployment

Bunting Admin ships with preconfigured templates so you can launch the dashboard in minutes.

## One-Click Hosting

Choose the provider that fits your stack—each option clones this repo and wires the defaults for you:

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/BenjaminBriggs/Bunting-Admin)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BenjaminBriggs/Bunting-Admin)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/BenjaminBriggs/Bunting-Admin)

After the build completes, open the deployed URL and the setup wizard will guide you through authentication.

## Post-Deployment Checklist

1. **Open the setup wizard** at `/setup` on your deployed domain.
2. **Choose your authentication providers** (Google, GitHub, Microsoft) and/or email magic links.
3. **Add OAuth credentials** for each provider you enable.
4. **Optionally connect a platform API** to store secrets in your infrastructure.
5. **Finish the wizard** and sign in. The first account becomes an admin automatically.

## OAuth Provider Guides

### Google
1. Visit the [Google Cloud Console](https://console.cloud.google.com) and select a project.
2. Create an OAuth 2.0 Client ID for a web application.
3. Add your app domain to the Authorized JavaScript origins and redirect URI (`/api/auth/callback/google`).
4. Copy the Client ID and Client Secret into the setup wizard.

### GitHub
1. Open **Settings → Developer settings → OAuth Apps**.
2. Create a new OAuth App with the callback URL `https://<your-domain>/api/auth/callback/github`.
3. Copy the Client ID and Secret.

### Microsoft
1. In the [Azure Portal](https://portal.azure.com), open **App registrations** and create a new application.
2. Configure a web redirect URI that ends with `/api/auth/callback/azure-ad`.
3. Copy the Client ID, Client Secret, and Tenant ID.

### Email Magic Links (Resend)
1. Create an account at [Resend](https://resend.com) and generate an API key.
2. Supply the key (and sending domain if configured) in the wizard.

## Access Control

- The first user to sign in is granted **Admin** access.
- Additional users start with **Developer** access.
- Admins can promote/demote accounts from the dashboard under **Settings → Team**.

Once authentication is configured, continue setting up your first application via the dashboard. For a product tour, see `docs/product-overview.md`.
