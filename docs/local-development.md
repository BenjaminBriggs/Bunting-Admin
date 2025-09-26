# Local Development

Spin up Bunting Admin locally with Docker-backed services and the standard Next.js toolchain.

## Prerequisites

- Node.js 18+
- Docker Desktop (or compatible Docker Engine) and Docker Compose
- npm or yarn

## Setup Steps

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Start infrastructure services** (PostgreSQL + MinIO)
   ```bash
   npm run docker:up
   npm run docker:logs   # optional health check
   ```
3. **Generate development RSA keys**
   ```bash
   node scripts/generate-dev-keys.js
   ```
4. **Apply the Prisma schema**
   ```bash
   npm run db:push
   # Optional visual client
   npm run db:studio
   ```
5. **Run the web app**
   ```bash
   npm run dev
   ```
6. Open http://localhost:3000.

## Local Services

- Bunting Admin UI: http://localhost:3000
- PostgreSQL: `localhost:5432` (`bunting` / `bunting_dev`)
- MinIO Console: http://localhost:9001 (`bunting` / `bunting_dev`)
- MinIO API: http://localhost:9000
- Prisma Studio: http://localhost:5555 (when `npm run db:studio` is active)

## Environment Notes

- Development credentials live in Docker containers; production deployments should use managed DB/S3.
- RSA keys for JWT signing are written to `./keys/` (ignored by git).
- Populate `.env` with production secrets before deploying.

## Helpful npm Scripts

```bash
npm run dev           # Next.js dev server
npm run build         # Production build
npm run start         # Serve production build

npm run db:push       # Apply Prisma schema
npm run db:migrate    # Generate + run migrations
npm run db:generate   # Regenerate Prisma client
npm run db:studio     # Launch Prisma Studio UI

npm run docker:up     # Start PostgreSQL + MinIO
npm run docker:down   # Stop Docker services
npm run docker:logs   # Tail container logs

npm run test          # Run test suite
npm run test:unit     # Unit tests only
npm run test:coverage # Coverage run
npm run lint          # ESLint
npm run type-check    # TypeScript compiler check

npm run setup         # Convenience script: docker + prisma setup
```
