# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Bunting admin web application.

## Project Overview

Bunting Admin is a fully implemented Next.js + React web application for managing feature flags and publishing signed config artifacts. It provides a complete web UI for application management, flag authoring, cohort management, validation, and publishing to S3/CDN storage.

## Current Implementation Status ✅

### Completed Features
- ✅ **Application Management**: Full CRUD with editable settings and SDK integration
- ✅ **Feature Flag Management**: Create, edit, archive, delete with visual rule builder
- ✅ **Cohort Management**: Percentage-based rollout groups with auto-generated salts
- ✅ **Publishing Pipeline**: Config generation, validation, S3 upload with versioning
- ✅ **Configuration Validation**: Real-time validation with error/warning categorization
- ✅ **Multi-App Support**: App selector with per-app isolation
- ✅ **Real-time Change Tracking**: Changes context with publish button visibility
- ✅ **SDK Integration**: Downloadable plist files for iOS/macOS apps

### Architecture Implemented

#### Frontend (Next.js 14 + React 18)
- **Application Settings**: Two-panel interface with editable app configuration
- **Flag Management**: Full CRUD with type support (bool, string, int, double, date, json)
- **Rule Builder**: Visual targeting rules with conditions (environment, version, platform, cohorts)
- **Publishing Interface**: Change detection, validation, and S3 deployment
- **Responsive Design**: Material-UI v5 with proper mobile support

#### Backend (Next.js API Routes)
- **Apps API**: `/api/apps` - Application CRUD operations
- **Flags API**: `/api/flags` - Feature flag CRUD operations  
- **Cohorts API**: `/api/cohorts` - Cohort CRUD operations
- **Config API**: `/api/config/*` - Generation, validation, publishing
- **Real S3 Integration**: Actual file uploads with versioning

#### Database (PostgreSQL + Prisma)
- **Apps**: Store app configs, artifact URLs, public keys, fetch policies
- **Flags**: Flag definitions with rules, types, and default values
- **Cohorts**: Percentage rollout definitions with salts
- **Audit Logs**: Publish history with versions and metadata

## Repository Structure (Current)

```
bunting-admin/
├── src/
│   ├── app/                      # Next.js 14+ app router
│   │   ├── dashboard/            # Main admin interface
│   │   │   ├── flags/           # Flag management pages
│   │   │   ├── cohorts/         # Cohort management pages
│   │   │   ├── publish/         # Publishing interface
│   │   │   ├── settings/        # Application CRUD interface
│   │   │   └── layout.tsx       # Dashboard layout with sidebar
│   │   ├── api/                 # Backend API routes
│   │   │   ├── apps/           # Application CRUD endpoints
│   │   │   ├── flags/          # Flag CRUD endpoints
│   │   │   ├── cohorts/        # Cohort CRUD endpoints
│   │   │   └── config/         # Config generation, validation, publishing
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Landing page
│   ├── components/             # React components
│   │   ├── flag-editor/       # Flag editing components
│   │   ├── rule-builder/      # Visual rule builder
│   │   └── theme-provider.tsx # MUI theme setup
│   ├── lib/                   # Shared utilities
│   │   ├── api.ts            # Client-side API functions
│   │   ├── config-generator.ts # Server-side config generation
│   │   ├── config-comparison.ts # S3 config comparison
│   │   ├── changes-context.tsx # Real-time change tracking
│   │   ├── db.ts             # Prisma client
│   │   └── utils.ts          # Utility functions
│   └── types/                # TypeScript definitions
│       ├── index.ts         # Core types
│       └── rules.ts         # Rule builder types
├── prisma/                   # Database schema
│   └── schema.prisma        # Prisma schema definition
├── scripts/                 # Utility scripts
└── package.json            # Dependencies and scripts
```

## Development Commands

```bash
# Setup
npm install                   # Install dependencies
npm run setup                 # Start Docker + initialize database

# Development
npm run dev                   # Start development server (http://localhost:3000)
npm run db:studio            # Open Prisma Studio for database management

# Database
npm run db:generate          # Generate Prisma client
npm run db:push             # Push schema to database
npm run db:migrate          # Create database migration

# Docker
npm run docker:up           # Start PostgreSQL container
npm run docker:down         # Stop containers
npm run docker:logs         # View container logs

# Production
npm run build               # Production build
npm run start              # Start production server
npm run lint               # Lint code
npm run type-check         # TypeScript checking
```

## Core Features Implemented

### Application Management
- **Two-Panel Interface**: App list on left, tabbed settings on right
- **Editable Settings**: Name and fetch policy (6-hour default minimum interval)
- **SDK Integration**: Download bunting-config.plist files
- **App Switching**: Dropdown selector with context switching
- **CRUD Operations**: Create, edit, delete with confirmation dialogs

### Feature Flag Management
- **Auto-normalization**: "Store: New Paywall" → "store/new_paywall"
- **Type Support**: bool, string, int, double, date, json with proper editors
- **Targeting Rules**: Visual rule builder with multiple conditions
- **Validation**: Real-time key validation and rule logic checking
- **Archiving**: Soft delete functionality

### Cohort Management  
- **Percentage Rollouts**: 0-100% user targeting
- **Auto-generated Salts**: Consistent user bucketing
- **User Estimation**: Mock calculation (needs real analytics integration)
- **Validation**: Unique keys per application

### Publishing Pipeline
- **Change Detection**: Real-time tracking of modified flags/cohorts
- **Config Generation**: Transform database data to SDK format
- **Validation Engine**: Blocking errors vs warnings
- **S3 Upload**: Versioned configs with YYYY-MM-DD.N format
- **Change Comparison**: Before/after diff visualization

### Multi-App Support
- **App Isolation**: Flags and cohorts scoped to applications
- **Shared Interface**: Single admin UI managing multiple apps
- **Context Switching**: Seamless app selection with state preservation

## Technical Implementation

### Flag Key Processing
```typescript
// Auto-normalize user input
normalizeKey("Store: Use New Paywall Design") 
// → "store/use_new_paywall_design"

// Real-time validation
validateKey("store/new_feature") // → { valid: true }
validateKey("store/123invalid") // → { valid: false, error: "cannot start with number" }
```

### Config Artifact Generation
```typescript
interface ConfigArtifact {
  schema_version: 1;
  config_version: string;        // "2025-09-12.1"
  published_at: string;          // ISO8601
  app_identifier: string;        // user-defined
  cohorts: Record<string, Cohort>;
  flags: Record<string, Flag>;
}
```

### Validation Rules (Implemented)
- **Blocking Errors**: Invalid JSON, missing defaults, unknown cohort references
- **Warnings**: Unreachable rules, long descriptions
- **Flag Keys**: snake_case validation with optional namespaces

## Environment Variables (Required)

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/bunting"

# S3 Storage (Required for publishing)
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
S3_BUCKET="bunting-configs"

# Optional S3 Configuration
S3_ENDPOINT="https://s3.amazonaws.com"  # Custom endpoint for S3-compatible storage
```

## User Interface

### Sidebar Navigation
- **App Selector**: Top-level dropdown with app switching and creation
- **Main Menu**: Feature Flags, Cohorts (middle section)
- **Settings**: Bottom section for application management

### Application Settings
- **Settings Tab**: Editable name and fetch policy (in hours)
- **SDK Integration Tab**: Plist download and integration instructions
- **Real-time Updates**: Changes immediately reflected across interface

### Publishing Flow
1. **Make Changes**: Edit flags/cohorts (changes tracked automatically)
2. **Review Changes**: Publish button appears with change count
3. **Validation**: Automatic validation with error/warning feedback
4. **Deploy**: One-click S3 upload with versioning

## Known Limitations & TODOs

### Mock Data Remaining
- **Cohort User Counts**: `totalUsers = 12500` in cohort forms (needs analytics API)

### Incomplete Features
- **Authentication**: No user authentication implemented
- **Publish History**: Database schema exists but queries not implemented
- **User Management**: No role-based access control
- **Audit Logging**: Schema exists but not fully implemented

### Future Enhancements
- **Real-time Collaboration**: Multi-user editing support
- **Advanced Analytics**: Flag usage metrics and performance data
- **A/B Test Analysis**: Statistical significance calculations
- **Bulk Operations**: Mass flag updates and imports
- **API Documentation**: Swagger/OpenAPI specs

## Security Notes

- **Input Validation**: All user inputs sanitized via Zod schemas
- **SQL Injection**: Protected by Prisma ORM
- **XSS Protection**: React's built-in escaping
- **Missing**: Authentication, authorization, rate limiting

## Testing Status

### Manual Testing ✅
- All CRUD operations work correctly
- Publishing pipeline functional with S3
- App switching and context preservation
- Form validation and error handling

### Missing Tests
- Unit tests for components
- API endpoint testing
- E2E workflow testing
- Error boundary testing

## Integration Points

### Current Integrations
- **PostgreSQL**: Full database integration via Prisma
- **AWS S3**: Real file uploads with versioning
- **Material-UI**: Complete design system implementation

### Missing Integrations
- **CDN**: No CDN distribution setup
- **Analytics**: No user metrics or flag usage data
- **Authentication**: No user management system
- **Monitoring**: No error tracking or performance monitoring

## Getting Started

1. **Clone and Install**:
   ```bash
   git clone <repo>
   cd bunting-admin
   npm install
   ```

2. **Setup Database**:
   ```bash
   npm run setup  # Starts Docker PostgreSQL + pushes schema
   ```

3. **Configure Environment**:
   Create `.env.local` with database and AWS credentials

4. **Start Development**:
   ```bash
   npm run dev  # Opens http://localhost:3000
   ```

5. **Access Admin**:
   - Create your first application in Settings
   - Add feature flags and cohorts
   - Test the publishing pipeline

The application is now fully functional for feature flag management with real S3 integration and database persistence.