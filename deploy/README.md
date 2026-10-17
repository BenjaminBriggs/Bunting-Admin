# Deploying Bunting Admin

This directory is the production deployment: the published container image, Postgres, Caddy for TLS, and database backups copied off the host. It runs on any machine with Docker Compose v2.24 or later.

Your deployment should not track the Bunting Admin repository. Each release attaches this directory as `bunting-admin-deploy-<version>.tar.gz`, with `BUNTING_VERSION` already pinned. Keep your copy in your own (private) deployment repo, and upgrade by changing `BUNTING_VERSION` when you choose to.

## What runs

| Service          | Image                                            | Job                                                            |
| ---------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| `app`            | `ghcr.io/benjaminbriggs/bunting-admin:<version>` | The admin. Applies database migrations on start.               |
| `caddy`          | `caddy:2`                                        | HTTPS on ports 80 and 443, with automatic certificates.        |
| `postgres`       | `postgres:17-alpine`                             | Flags, publish history, and the encrypted signing keys.        |
| `backup`         | `postgres:17-alpine`                             | `pg_dump` every 24 hours into a local volume, keeping 14 days. |
| `backup-offsite` | `rclone/rclone:1`                                | Copies those dumps to an S3-compatible bucket every hour.      |

Your apps never talk to this stack. They fetch the signed config from your CDN, so the admin being down only stops publishing.

## First deploy

1. Point a DNS record for the admin's domain at the host. Caddy needs ports 80 and 443 reachable to get a certificate.
2. Copy this directory to the host (or clone your deployment repo there).
3. `cp .env.example .env` and fill in every value marked REQUIRED.
4. Store `SIGNING_KEY_SECRET` in your password manager. Backups hold the signing keys encrypted with this secret, so without it a restored database can no longer sign configs. Keep the backup bucket private: the dumps themselves are not encrypted.
5. `docker compose up -d`
6. Open `https://<your domain>` and sign in. The first account to sign in becomes the admin, so do this before sharing the URL.

## Upgrading

1. Read the release notes and [docs/upgrading.md](../docs/upgrading.md) for every version between yours and the new one.
2. Take a backup: `docker compose exec backup sh -c 'pg_dump --format=custom --file=/backups/bunting-pre-upgrade.dump'`
3. Set `BUNTING_VERSION` in `.env` to the new version.
4. `docker compose pull app && docker compose up -d`

Migrations only go forward. To roll back, restore the pre-upgrade dump (below) and set `BUNTING_VERSION` back.

## Restoring a backup

Dumps are in the `backups` volume and in `BACKUP_S3_BUCKET/BACKUP_S3_PREFIX`.

```bash
docker compose stop app
docker compose cp ./bunting-20261010T030000Z.dump postgres:/tmp/restore.dump
docker compose exec postgres pg_restore --clean --if-exists -U bunting -d bunting /tmp/restore.dump
docker compose start app
```

The restored signing keys only decrypt with the `SIGNING_KEY_SECRET` (or KMS key) that was in use when the dump was taken.

## Using an external Postgres

Set `DATABASE_URL` in `.env`, then delete the `postgres` and `backup` services and the `depends_on` entries that name them, and point `backup-offsite` at your provider's backups or remove it. Your provider's point-in-time recovery replaces the bundled backups.

## Trying it locally

`compose.local.yaml` runs this same stack on your machine with MinIO in place of R2 and dex in place of your identity provider. From the repository root:

```bash
make smoke-deploy   # builds the image, runs the stack, signs in, publishes, verifies, tears down
```
