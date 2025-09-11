# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Bunting admin web application.

## Project Overview

Bunting Admin is a Next.js + React web application for managing feature flags and publishing signed config artifacts. It provides a web UI for flag authoring, cohort management, validation, and publishing to CDN/object storage.

## Architecture

### Frontend (Next.js + React)
- **Flag Management**: Create, edit, archive, and delete feature flags
- **Cohort Management**: Define percentage rollout groups with auto-generated salts
- **Publishing Interface**: Review changes, add changelog notes, publish configs
- **Multi-App Support**: App selector for managing multiple applications
- **Validation Feedback**: Real-time flag key normalization and rule validation

### Backend (Next.js API Routes)
- **Flag CRUD**: RESTful endpoints for flag and cohort operations
- **Validation Engine**: Blocking vs warning validation rules
- **Publishing Pipeline**: Config generation, versioning (YYYY-MM-DD.N), signing (JWS)
- **Storage Integration**: Upload to S3/B2 + CDN with proper headers
- **Audit Logging**: Track all publishes with diffs and metadata

### Key Integrations
- **CDN/Object Storage**: S3-compatible storage with CloudFront/CDN
- **Signing**: JWS detached signatures using managed private keys
- **Database**: Store flags, cohorts, app configs, audit logs (SQLite/PostgreSQL)

## Repository Structure

```
bunting-admin/
├── src/
│   ├── app/                   # Next.js 13+ app router
│   │   ├── (dashboard)/       # Main admin interface
│   │   │   ├── flags/         # Flag management pages
│   │   │   ├── cohorts/       # Cohort management pages
│   │   │   └── publish/       # Publishing interface
│   │   └── api/               # Backend API routes
│   │       ├── flags/         # Flag CRUD endpoints
│   │       ├── cohorts/       # Cohort CRUD endpoints
│   │       ├── validate/      # Validation endpoints
│   │       └── publish/       # Publishing endpoint
│   ├── components/            # React components
│   │   ├── ui/               # Base components (buttons, inputs, etc.)
│   │   ├── flag-editor/      # Flag editing components
│   │   └── rule-builder/     # Visual rule builder
│   ├── lib/                  # Shared utilities
│   │   ├── validation/       # Flag and rule validation logic
│   │   ├── storage/          # S3/CDN upload utilities
│   │   ├── signing/          # JWS signature generation
│   │   └── db/               # Database schema and queries
│   └── types/                # TypeScript type definitions
├── prisma/                   # Database schema (if using Prisma)
├── tests/
│   ├── unit/                 # Component and utility tests
│   └── e2e/                  # End-to-end tests
├── public/                   # Static assets
└── docs/                     # Admin-specific documentation
```

## Development Commands

```bash
npm install                   # Install dependencies
npm run dev                   # Start development server (http://localhost:3000)
npm run build                 # Production build
npm run start                 # Start production server
npm run test                  # Run unit tests
npm run test:e2e             # Run E2E tests with Playwright
npm run lint                 # Lint code with ESLint
npm run type-check           # TypeScript type checking
```

## Core Features

### Flag Management
- **Auto-normalization**: "Store: New Paywall" → "store/new_paywall" 
- **Type Support**: bool, string, int, double, date, json
- **Rule Builder**: Visual React interface for environment, version, cohort conditions
- **Validation**: Real-time feedback for invalid keys, unreachable rules (warnings)

### Publishing Workflow
1. **Change Detection**: Show diff of modified flags/cohorts
2. **Validation**: Run blocking checks (schema, references, types)
3. **Versioning**: Auto-increment YYYY-MM-DD.N format
4. **Signing**: Generate detached JWS signature
5. **Upload**: Deploy config.json + config.json.sig to CDN
6. **Audit**: Log publish event with changelog and metadata

### Multi-App Support
- User-defined app identifiers (independent of bundle IDs)
- App-scoped flag management with shared cohort definitions
- Per-app artifact URLs and signing keys configuration

## Key Technical Decisions

### Flag Key Processing
```typescript
// Auto-normalize user input
normalizeKey("Store: Use New Paywall Design") 
// → "store/use_new_paywall_design"

// Validation without approval required
validateKey("store/new_feature") // → valid
validateKey("store/123invalid") // → error: cannot start with number
```

### Config Artifact Generation
```typescript
interface ConfigArtifact {
  schema_version: 1;
  config_version: string;        // "2025-09-11.1"
  published_at: string;          // ISO8601
  app_identifier: string;        // user-defined
  cohorts: Record<string, Cohort>;
  flags: Record<string, Flag>;
  metadata?: Record<string, any>;
}
```

### Validation Rules
- **Blocking**: Invalid JSON, missing defaults, unknown cohort references
- **Warnings**: Unreachable rules, long descriptions, archived flags still present
- **Flag Keys**: Must be valid snake_case with optional / namespaces

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost/bunting"

# Storage
S3_ENDPOINT="https://s3.amazonaws.com"
S3_BUCKET="bunting-configs"
CDN_BASE_URL="https://cdn.example.com"

# Signing
PRIVATE_KEY_PATH="/path/to/private.pem"
# or PRIVATE_KEY_KMS_KEY_ID for managed keys

# App
NEXTAUTH_SECRET="your-auth-secret"
NEXTAUTH_URL="http://localhost:3000"
```

## Testing Strategy

### Unit Tests (Jest + React Testing Library)
- Flag validation logic
- Key normalization functions
- Config artifact generation
- React component behavior

### E2E Tests (Playwright)
- Complete flag creation → publish workflow
- Multi-app switching and isolation
- Rule validation feedback
- Error handling for storage/signing failures

### API Testing
- CRUD operations with proper validation
- Publishing pipeline edge cases
- Authentication and authorization

## Security Considerations

- **Input Validation**: Sanitize all user inputs, especially flag keys and JSON values
- **Authentication**: Secure admin access (consider NextAuth.js)
- **Key Management**: Never expose private signing keys in logs or client code
- **CORS**: Proper cross-origin configuration for API endpoints
- **Rate Limiting**: Prevent abuse of publishing endpoints
- **Audit Trail**: Log all administrative actions with user attribution

## React Patterns

### Flag Editor Component
```typescript
interface FlagEditorProps {
  flag?: Flag;
  onSave: (flag: Flag) => void;
  onCancel: () => void;
}

export function FlagEditor({ flag, onSave, onCancel }: FlagEditorProps) {
  const [key, setKey] = useState(flag?.key || '');
  const [normalizedKey, setNormalizedKey] = useState('');
  
  // Auto-normalize keys on blur
  const handleKeyBlur = () => {
    const normalized = normalizeKey(key);
    setNormalizedKey(normalized);
  };
  
  // Show validation errors immediately
  const validationError = validateKey(normalizedKey);
  
  return (
    // JSX implementation
  );
}
```

### Publishing Flow
```typescript
// 1. Validate all changes
const validation = await validateConfig(config);
if (validation.errors.length > 0) return;

// 2. Generate versioned config
const versionedConfig = {
  ...config,
  config_version: generateVersion(), // YYYY-MM-DD.N
  published_at: new Date().toISOString()
};

// 3. Sign and upload
const signature = await signConfig(versionedConfig);
await uploadToStorage(versionedConfig, signature);
```

## Integration Points

- **CDN Cache**: Set proper Cache-Control headers (max-age=300, stale-while-revalidate=86400)
- **ETag Support**: Generate ETags for conditional requests
- **Historical Versions**: Optionally store /versions/{config_version}.json
- **SDK Compatibility**: Ensure generated configs match SDK expectations