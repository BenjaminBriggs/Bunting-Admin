<div align="center">
  <img src="https://raw.githubusercontent.com/BenjaminBriggs/Bunting-Admin/main/public/images/Logotype.png" alt="Bunting" width="400" />
</div>

# Bunting Admin

[![Tests](https://github.com/BenjaminBriggs/Bunting-Admin/workflows/Tests/badge.svg)](https://github.com/BenjaminBriggs/Bunting-Admin/actions)
[![Build](https://github.com/BenjaminBriggs/Bunting-Admin/workflows/Build/badge.svg)](https://github.com/BenjaminBriggs/Bunting-Admin/actions)
[![License](https://img.shields.io/github/license/BenjaminBriggs/Bunting-Admin)](https://github.com/BenjaminBriggs/Bunting-Admin/blob/main/LICENSE)

A self-hosted feature flag dashboard for iOS and macOS apps. Deploy in one click and manage feature flags, A/B tests, and gradual rollouts with a beautiful web interface.

> [!WARNING]
> **Work in Progress**: Bunting Admin is currently under active development and is not yet ready for production use. Features may be incomplete, unstable, or subject to breaking changes. Use for testing and development purposes only.

## 🚀 One-Click Deployment

Deploy Bunting Admin to your preferred platform with a single click:

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/BenjaminBriggs/Bunting-Admin)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BenjaminBriggs/Bunting-Admin)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/BenjaminBriggs/Bunting-Admin)

After deployment, visit your app URL and complete the authentication setup wizard to get started.

## 🛠 Post-Deployment Setup

After deploying with one of the buttons above:

### 1. Complete Authentication Setup
1. Visit your deployed app URL (e.g., `https://your-app.herokuapp.com`)
2. You'll be redirected to the setup wizard at `/setup`
3. Follow the 5-step process:
   - **Welcome**: Introduction to the setup process
   - **Choose Authentication**: Select OAuth providers (Google, GitHub, Microsoft) and/or email magic links
   - **Configure Providers**: Enter your OAuth credentials or email settings
   - **Platform Integration** (Optional): Connect platform API for secure credential storage
   - **Complete Setup**: Review configuration and finish

### 2. Get OAuth Credentials

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Create **OAuth 2.0 Client ID** for web application
5. Add your deployed URL to authorized origins and redirect URIs
6. Note the Client ID and Client Secret

#### GitHub OAuth
1. Go to GitHub **Settings** → **Developer settings** → **OAuth Apps**
2. Create a new OAuth App
3. Set Authorization callback URL to `https://your-app.com/api/auth/callback/github`
4. Note the Client ID and Client Secret

#### Microsoft OAuth
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **App registrations**
3. Create a new registration
4. Configure redirect URI for your app
5. Note the Client ID, Client Secret, and Tenant ID

#### Email Magic Links (Resend)
1. Sign up at [Resend](https://resend.com)
2. Go to **API Keys** and create a new key
3. Configure your sending domain (or use their shared domain for testing)

### 3. First Admin Account
- The first user to sign in through your configured providers will automatically become an admin
- Additional users will have developer permissions by default
- Admins can manage access control in the dashboard

## 💻 Local Development

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
npm run test         # Run all tests
npm run test:unit    # Run unit tests only
npm run test:coverage # Run tests with coverage report
npm run test:coverage:open # Run coverage and open HTML report
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

## ✨ Key Features

### 🎯 Feature Flag Management
- **Environment-First Flags**: Separate values for development, staging, and production
- **Type-Safe**: Support for bool, string, int, double, date, and JSON values
- **Conditional Variants**: Rule-based value overrides per environment
- **Auto-normalization**: Convert "Store: New Paywall" → "store/new_paywall"

### 🧪 A/B Testing & Rollouts
- **Multi-Variant Tests**: Traffic splitting with statistical analysis
- **Gradual Rollouts**: Percentage-based feature rollouts with real-time controls
- **Test Management**: Create, run, pause, and complete tests with result tracking
- **Archive Functionality**: Cancel (0%) or complete (100%) tests and rollouts

### 👥 User Targeting
- **Rule-Based Cohorts**: Reusable condition groups for user targeting
- **Visual Rule Builder**: Define complex targeting with AND/OR logic
- **Environment Awareness**: Target users based on app version, platform, and environment

### 🚀 Publishing Pipeline
- **Change Detection**: Real-time tracking of modified flags and cohorts
- **Config Generation**: Transform database data to SDK-compatible format
- **Validation Engine**: Blocking errors vs warnings with environment-specific feedback
- **S3 Integration**: Versioned configs with YYYY-MM-DD.N format

### 🏢 Multi-App Support
- **App Isolation**: Flags and cohorts scoped to applications
- **Shared Interface**: Single admin UI managing multiple apps
- **Context Switching**: Seamless app selection with state preservation

### 🔒 Security & Authentication
- **OAuth Providers**: Google, GitHub, Microsoft authentication
- **Magic Links**: Email-based passwordless authentication
- **Access Control**: Role-based permissions (Admin/Developer)
- **Secure Credentials**: Optional platform API integration for environment variables

### 🛠 Developer Experience
- **Type-Safe**: Full TypeScript with Prisma ORM
- **Local Development**: Docker Compose for PostgreSQL + MinIO
- **One-Click Deploy**: Support for Heroku, Render, Railway, and Vercel
- **Setup Wizard**: Post-deployment authentication configuration

## 📖 Getting Started

### For iOS/macOS Developers

1. **Deploy**: Click one of the deployment buttons above
2. **Setup Authentication**: Complete the setup wizard
3. **Create Your First App**: Add your iOS/macOS app in Settings
4. **Add Feature Flags**: Create environment-specific flags for your features
5. **Integrate SDK**: Download the generated configuration and integrate with your app
6. **Start Testing**: Create A/B tests and gradual rollouts

### Dashboard Overview

- **Feature Flags**: Environment-first flag management with conditional variants
- **A/B Tests**: Multi-variant testing with traffic splitting
- **Rollouts**: Gradual feature rollouts with percentage controls
- **Cohorts**: Reusable user targeting rules
- **Releases**: Publishing interface with change tracking
- **Settings**: App management and SDK integration

## 🧪 Testing & Coverage

Bunting Admin includes a comprehensive test suite with high coverage requirements:

### Test Types
- **Unit Tests**: Core business logic, validation, and service functions
- **Performance Tests**: Flag evaluation speed and constitutional requirements
- **Contract Tests**: API endpoint behavior and response formats
- **End-to-End Tests**: Full user workflows (Playwright)

### Coverage Requirements
- **90% minimum** for lines, functions, branches, and statements
- Coverage reports generated in multiple formats (text, HTML, LCOV)
- Automatic coverage reporting via GitHub Actions and Codecov

### Running Tests
```bash
npm run test:unit           # Unit tests only (fast)
npm run test:coverage       # Full coverage report
npm run test:coverage:open  # Coverage report + open in browser
npm run test:e2e           # End-to-end tests
```

## 🤝 Contributing

This project is part of the Bunting ecosystem - a self-hosted feature flag system for Apple platforms. Contributions are welcome!

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