#!/usr/bin/env bash
#
# Full-stack smoke test: bring up a FRESH docker-compose stack (Postgres, MinIO,
# dex OIDC, app), wait for it to be healthy, run the Playwright smoke spec that
# drives the real key paths (login → create app → create a flag of each type →
# publish), then tear the stack down.
#
# Usage:
#   scripts/smoke.sh            # fresh stack, run smoke, tear down
#   KEEP_STACK=1 scripts/smoke.sh   # leave the stack up afterwards (debugging)
#   NO_BUILD=1 scripts/smoke.sh     # skip image rebuild (faster; deps must be current)
#
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose"
BASE_URL="http://localhost:3000"
HEALTH_URL="${BASE_URL}/api/health"

cleanup() {
	if [ "${KEEP_STACK:-0}" = "1" ]; then
		echo "==> KEEP_STACK=1 — leaving the stack running. Tear down with: docker compose down -v"
		return
	fi
	echo "==> Tearing down stack"
	$COMPOSE down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Resetting any existing stack (fresh database)"
$COMPOSE down -v >/dev/null 2>&1 || true

echo "==> Starting stack"
if [ "${NO_BUILD:-0}" = "1" ]; then
	$COMPOSE up -d
else
	$COMPOSE up -d --build
fi

echo "==> Waiting for the app to become healthy (${HEALTH_URL})"
ready=0
for i in $(seq 1 150); do
	code=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || true)
	if [ "$code" = "200" ]; then
		echo "    app healthy after ~$((i * 2))s"
		ready=1
		break
	fi
	sleep 2
done

if [ "$ready" != "1" ]; then
	echo "!! app did not become healthy in time — recent app logs:"
	$COMPOSE logs --tail=80 app || true
	exit 1
fi

echo "==> Running Playwright smoke spec"
PLAYWRIGHT_BASE_URL="$BASE_URL" pnpm exec playwright test --config playwright.smoke.config.ts
