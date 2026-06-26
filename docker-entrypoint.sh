#!/bin/sh
# Production container entrypoint: apply database migrations, then start the
# standalone Next.js server. Used by the Docker (runner) image — e.g. the Render
# blueprint — so a one-click deploy reaches a schema-synced, running app without
# a separate migration step.
set -e

echo "==> Applying database migrations (prisma migrate deploy)"
# The prisma CLI lives in the isolated /migrate toolchain (see Dockerfile).
(cd /migrate && node_modules/.bin/prisma migrate deploy)

echo "==> Starting server"
exec node server.js
