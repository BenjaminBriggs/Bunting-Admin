# Local Development

Spin up Bunting Admin locally with Docker-backed services and the standard Next.js toolchain.

## Prerequisites

- Node.js 22+ (CI runs on 22 and 24; `package.json` requires `>=22`)
- pnpm 11 (`npm install -g pnpm@11`)
- Docker Desktop (or compatible Docker Engine) and Docker Compose

## Setup Steps

1. **Install dependencies**
   ```bash
   make install
   ```
2. **Start infrastructure services** (PostgreSQL + MinIO + Dex OIDC) and apply the schema
   ```bash
   make setup
   docker compose logs -f   # optional health check
   ```
3. **Run the web app**
   ```bash
   make dev
   ```
4. Open http://localhost:3000.

## Local Services

- Bunting Admin UI: http://localhost:3000
- PostgreSQL: `localhost:5432` (user: `admin` / pass: `admin123`)
- MinIO Console: http://localhost:9001 (user: `admin` / pass: `admin123`)
- MinIO API: http://localhost:9000
- Dex OIDC: http://auth.localhost:5556/dex (login: `admin@bunting.dev` / `password`)
- Prisma Studio: http://localhost:5555 (when `pnpm run db:studio` is active)

## Environment Notes

- Development credentials live in Docker containers; production deployments should use managed DB/S3.
- Populate `.env.local` with production secrets before deploying.

## Make targets

```bash
make install        # pnpm install --frozen-lockfile
make setup          # docker compose up + schema push
make dev            # Next.js dev server
make build          # Production build
make start          # Serve production build

make db-generate    # Regenerate Prisma client
make db-migrate     # Run database migrations
make lint           # ESLint
make format         # Prettier check
make type-check     # TypeScript compiler check
make test           # All tests
make test-unit      # Unit tests only
make test-integration # Integration tests (requires Postgres)
make test-e2e       # Playwright e2e tests
make clean          # Remove .next, coverage, node_modules
```

Direct pnpm / docker equivalents when needed outside Make:

```bash
docker compose up -d          # Start services
docker compose down           # Stop services
docker compose logs -f        # Tail logs
pnpm run db:studio            # Launch Prisma Studio UI
```
