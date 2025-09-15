# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Bunting admin web application.

## Project Overview

Bunting Admin is a fully implemented Next.js + React web application for managing feature flags with environment-specific configurations, A/B testing, and gradual rollouts. It provides a complete web UI for application management, environment-first flag authoring, A/B tests, rollouts, rule-based cohorts, and publishing to S3/CDN storage.

## Current Implementation Status ✅

### Completed Features
- ✅ **Application Management**: Full CRUD with editable settings and SDK integration
- ✅ **Environment-First Flags**: Separate default values for development/staging/production
- ✅ **A/B Testing**: Multi-variant tests with traffic splitting and statistical analysis
- ✅ **Gradual Rollouts**: Percentage-based feature rollouts with real-time controls
- ✅ **Rule-Based Cohorts**: Reusable condition groups for user targeting
- ✅ **Conditional Variants**: Environment-specific rule-based overrides
- ✅ **Publishing Pipeline**: Environment-first config generation with schema v2
- ✅ **Configuration Validation**: Real-time validation with error/warning categorization
- ✅ **Multi-App Support**: App selector with per-app isolation
- ✅ **Real-time Change Tracking**: Changes context with publish button visibility
- ✅ **SDK Integration**: Downloadable plist files for iOS/macOS apps

### Architecture Implemented

#### Frontend (Next.js 14 + React 18)
- **Application Settings**: Two-panel interface with editable app configuration
- **Environment-First Flags**: Flag management with per-environment defaults and variants
- **A/B Test Management**: Traffic splitting, variant configuration, and result tracking
- **Rollout Management**: Interactive percentage sliders with real-time updates
- **Rule-Based Cohorts**: Condition group management without percentage/salt complexity
- **Rule Builder**: Visual targeting rules with conditions (environment, version, platform, cohorts)
- **Publishing Interface**: Environment-aware change detection, validation, and S3 deployment
- **Responsive Design**: Material-UI v5 with proper mobile support

#### Backend (Next.js API Routes)
- **Apps API**: `/api/apps` - Application CRUD with test_rollouts counting
- **Flags API**: `/api/flags` - Environment-first flag CRUD with defaultValues/variants
- **Tests API**: `/api/tests` - A/B test management with traffic validation
- **Rollouts API**: `/api/rollouts` - Gradual rollout management with archiving
- **Cohorts API**: `/api/cohorts` - Rule-based cohort groups (no percentage/salt)
- **Config API**: `/api/config/*` - Environment-first generation with schema v2
- **Real S3 Integration**: Actual file uploads with versioning

#### Database (PostgreSQL + Prisma)
- **Apps**: Store app configs, artifact URLs, public keys, fetch policies
- **Flags**: Environment-first definitions with defaultValues (dev/staging/prod) and variants
- **TestRollouts**: Unified model for both A/B tests (with variants) and rollouts (with percentage)
- **Cohorts**: Rule-based condition groups (conditions JSON, no percentage/salt)
- **Audit Logs**: Publish history with versions and metadata

## Repository Structure (Current)

```
bunting-admin/
├── src/
│   ├── app/                      # Next.js 14+ app router
│   │   ├── dashboard/            # Main admin interface
│   │   │   ├── flags/           # Environment-first flag management
│   │   │   ├── tests/           # A/B test management with variants
│   │   │   ├── rollouts/        # Gradual rollout management
│   │   │   ├── cohorts/         # Rule-based cohort groups
│   │   │   ├── releases/        # Publishing interface with change tracking
│   │   │   ├── settings/        # Application CRUD interface
│   │   │   └── layout.tsx       # Dashboard layout with Tests/Rollouts nav
│   │   ├── api/                 # Backend API routes
│   │   │   ├── apps/           # Application CRUD endpoints
│   │   │   ├── flags/          # Environment-first flag CRUD
│   │   │   ├── tests/          # A/B test CRUD with traffic validation
│   │   │   ├── rollouts/       # Rollout CRUD with archiving
│   │   │   ├── test-rollouts/  # Unified test/rollout management
│   │   │   ├── cohorts/        # Rule-based cohort CRUD
│   │   │   └── config/         # Environment-first config generation
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Landing page
│   ├── components/             # React components
│   │   ├── flag-editor/       # Environment-aware flag editing
│   │   ├── rule-builder/      # Visual rule builder
│   │   └── theme-provider.tsx # MUI theme setup
│   ├── lib/                   # Shared utilities
│   │   ├── api.ts            # Client-side API functions
│   │   ├── config-generator.ts # Environment-first config generation
│   │   ├── config-comparison.ts # S3 config comparison
│   │   ├── changes-context.tsx # Real-time change tracking
│   │   ├── db.ts             # Prisma client
│   │   └── utils.ts          # Utility functions
│   └── types/                # TypeScript definitions
│       ├── index.ts         # Core types with schema v2
│       └── rules.ts         # Rule builder types
├── prisma/                   # Database schema
│   └── schema.prisma        # Updated schema with TestRollouts
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

### Environment-First Feature Flags
- **Auto-normalization**: "Store: New Paywall" → "store/new_paywall"
- **Environment Defaults**: Separate default values for development, staging, production
- **Conditional Variants**: Per-environment rule-based value overrides
- **Type Support**: bool, string, int, double, date, json with proper editors
- **Visual Interface**: Expandable cards with environment columns and variant sections
- **Validation**: Real-time key validation and environment consistency checking
- **Archiving**: Soft delete functionality

### A/B Testing & Rollouts
- **A/B Tests**: Multi-variant testing with traffic percentage allocation
- **Gradual Rollouts**: Simple percentage-based feature rollouts with real-time sliders
- **Test Management**: Create, run, pause, and complete tests with statistical tracking
- **Rollout Controls**: Interactive percentage controls with optimistic UI updates
- **Archive Functionality**: Cancel (0%) or complete (100%) tests and rollouts
- **Flag Integration**: Tests and rollouts can target multiple flags simultaneously

### Rule-Based Cohorts
- **Condition Groups**: Pure rule-based user targeting without percentages
- **Reusable Rules**: Create cohorts once, use across multiple flags and tests
- **Visual Rule Builder**: Define complex targeting conditions with AND/OR logic
- **No Salt Complexity**: Simplified model focused on rule definition only
- **Validation**: Unique keys per application with circular reference prevention

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

### Config Artifact Generation (Schema v2)
```typescript
interface ConfigArtifact {
  schema_version: 2;
  config_version: string;        // "2025-09-12.1"
  published_at: string;          // ISO8601
  app_identifier: string;        // user-defined
  
  // Environment-first structure
  development: EnvironmentConfig;
  staging: EnvironmentConfig;
  production: EnvironmentConfig;
}

interface EnvironmentConfig {
  cohorts: Record<string, ConditionGroup>;
  flags: Record<string, EnvironmentFlag>;
  tests: Record<string, EnvironmentTest>;
  rollouts: Record<string, EnvironmentRollout>;
}

interface EnvironmentFlag {
  type: 'bool' | 'string' | 'int' | 'double' | 'date' | 'json';
  default: any;
  variants?: ConditionalVariant[];
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
- **Logo**: Clickable logo at top linking to dashboard
- **App Selector**: Top-level dropdown with app switching and creation
- **Main Menu**: Feature Flags, A/B Tests, Rollouts, Cohorts (middle section)
- **Releases**: Publishing interface with change count badge
- **Settings**: Bottom section for application management

### Application Settings
- **Settings Tab**: Editable name and fetch policy (in hours)
- **SDK Integration Tab**: Plist download and integration instructions
- **Real-time Updates**: Changes immediately reflected across interface

### Publishing Flow
1. **Make Changes**: Edit flags, create tests/rollouts, modify cohorts (changes tracked automatically)
2. **Review Changes**: Releases page shows pending changes with badge count in sidebar
3. **Environment Selection**: Choose which environment(s) to publish (dev/staging/prod)
4. **Validation**: Automatic validation with environment-specific error/warning feedback
5. **Deploy**: One-click S3 upload with environment-aware versioning

## Known Limitations & TODOs

### Mock Data Remaining
- **Test Result Analytics**: Statistical significance calculations need real data
- **Rollout Impact Metrics**: User impact estimation needs analytics integration

### Incomplete Features
- **Authentication**: No user authentication implemented
- **Test Analytics**: A/B test statistical analysis needs implementation
- **Flag Creation Flow**: Still needs update to new environment-first model
- **User Management**: No role-based access control
- **Advanced Rollout Scheduling**: Time-based rollout progression not implemented

### Future Enhancements
- **Real-time Collaboration**: Multi-user editing support
- **Advanced Analytics**: Flag usage metrics and performance data
- **Statistical Analysis**: Confidence intervals, significance testing for A/B tests
- **Automated Rollouts**: Time-based percentage progression
- **Environment Promotion**: Promote configs from staging to production
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
   - Add environment-first feature flags with development/staging/production defaults
   - Create A/B tests with traffic splitting or gradual rollouts
   - Define reusable rule-based cohorts
   - Test the environment-aware publishing pipeline

The application is now fully functional for environment-first feature flag management, A/B testing, gradual rollouts, and rule-based user targeting with real S3 integration and database persistence.