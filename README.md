# Bunting Admin

Feature flag management interface for Bunting - a self-hosted feature flag system.

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Services
```bash
# Start PostgreSQL and MinIO (S3-compatible storage)
npm run docker:up

# Check services are running
npm run docker:logs
```

### 3. Generate Development Keys
```bash
node scripts/generate-dev-keys.js
```

### 4. Set Up Database
```bash
# Create database tables
npm run db:push

# Optional: Open Prisma Studio to view data
npm run db:studio
```

### 5. Start Development Server
```bash
npm run dev
```

Visit http://localhost:3000

## Local Services

When running locally, you'll have access to:

- **Bunting Admin**: http://localhost:3000
- **PostgreSQL**: localhost:5432 (user: `bunting`, password: `bunting_dev`)
- **MinIO Console**: http://localhost:9001 (user: `bunting`, password: `bunting_dev`)
- **MinIO API**: http://localhost:9000
- **Prisma Studio**: http://localhost:5555 (when running `npm run db:studio`)

## Environment Configuration

The local environment uses:
- **Database**: PostgreSQL in Docker
- **Storage**: MinIO (S3-compatible) in Docker
- **Keys**: Auto-generated RSA keys in `./keys/`

For production, update `.env` with real database and S3 credentials.

## Available Scripts

```bash
# Development
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run start        # Start production server

# Database (Prisma)
npm run db:push      # Push schema to database
npm run db:migrate   # Create and run migrations
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio

# Docker Services
npm run docker:up    # Start PostgreSQL and MinIO
npm run docker:down  # Stop and remove containers
npm run docker:logs  # View container logs

# Testing
npm run test         # Run unit tests
npm run test:e2e     # Run E2E tests
npm run lint         # Lint code
npm run type-check   # TypeScript checks

# Quick setup (all-in-one)
npm run setup        # Start Docker + setup database
```

## Project Structure

```
bunting-admin/
├── prisma/           # Database schema and migrations
├── scripts/          # Development utilities
├── src/
│   ├── app/         # Next.js 13+ app router
│   ├── components/  # React components
│   ├── lib/         # Utilities and business logic
│   └── types/       # TypeScript definitions
├── keys/            # Development signing keys (git-ignored)
└── docker-compose.yml
```

## Key Features

- **Type-Safe**: Full TypeScript with Prisma ORM
- **Local Development**: Docker Compose for PostgreSQL + MinIO
- **Developer-Friendly**: Prisma Studio, hot reload, proper error handling
- **Production Ready**: Environment-based configuration, proper key management

## Next Steps

1. Build the dashboard UI (`/dashboard`)
2. Implement flag editor interface
3. Add publishing workflow with JWS signing
4. Set up multi-app support
5. Add validation and testing

## Troubleshooting

### Database Connection Issues
```bash
# Reset database
npm run docker:down
npm run docker:up
npm run db:push
```

### MinIO Issues
Visit the MinIO console at http://localhost:9001 to verify bucket creation.

### Key Generation Issues
Re-run the key generator:
```bash
rm -rf keys/
node scripts/generate-dev-keys.js
```