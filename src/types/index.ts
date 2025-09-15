// Core Bunting types for new simplified architecture

// Environment-first config structure
export interface ConfigArtifact {
  schema_version: 2;
  config_version: string;
  published_at: string;
  app_identifier: string;
  development: EnvironmentConfig;
  staging: EnvironmentConfig;
  production: EnvironmentConfig;
  metadata?: Record<string, any>;
}

export interface EnvironmentConfig {
  flags: Record<string, Flag>;
  cohorts: Record<string, Cohort>;
  test_rollouts?: Record<string, TestRollout>;
}

// Cohorts are now pure condition groups
export interface Cohort {
  name: string;
  description?: string;
  conditions: Condition[];
}

// Flags have default values and variants per environment
export interface Flag {
  type: FlagType;
  default: FlagValue;
  variants?: FlagVariant[];
  description?: string;
  archived?: boolean;
  archived_at?: string;
}

export interface FlagVariant {
  id: string;
  name: string;
  type: 'test_rollout' | 'conditional';
  value: FlagValue;
  
  // For test/rollout variants
  test_rollout_id?: string;
  variant_name?: string;
  
  // For conditional variants
  conditions?: Condition[];
  
  order: number;
}

export type FlagType = 'bool' | 'string' | 'int' | 'double' | 'date' | 'json';

export type FlagValue = boolean | string | number | object;

export type Environment = 'development' | 'staging' | 'production';

export type Platform = 'iOS' | 'iPadOS' | 'macOS' | 'watchOS' | 'tvOS';

// Unified condition system
export interface Condition {
  id: string;
  type: 'environment' | 'app_version' | 'os_version' | 'platform' | 'country' | 'cohort';
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_than_or_equal' | 'less_than_or_equal' | 'in' | 'not_in';
  values: string[];
  attribute?: string; // For custom attributes
}

// Tests and Rollouts
export interface TestRollout {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: 'test' | 'rollout';
  salt: string;
  conditions: Condition[];
  
  // For tests: multiple variants with traffic split
  variants?: Record<string, TestVariant>;
  
  // For rollouts: single percentage
  percentage?: number;
  
  flag_assignments: FlagAssignment[];
  archived?: boolean;
  archived_at?: string;
}

export interface TestVariant {
  percentage: number;
  values: {
    development: FlagValue;
    staging: FlagValue;
    production: FlagValue;
  };
}

export interface FlagAssignment {
  flag_id: string;
  flag_key: string;
  values: {
    development: FlagValue;
    staging: FlagValue;
    production: FlagValue;
  } | Record<string, { // For tests with variants
    development: FlagValue;
    staging: FlagValue;
    production: FlagValue;
  }>;
}

// Admin-specific types

export interface AppConfig {
  id: string;
  name: string;
  identifier: string;
  artifact_url: string;
  public_keys: PublicKey[];
  fetch_policy: FetchPolicy;
  created_at: string;
  updated_at: string;
  _count?: {
    flags: number;
    cohorts: number;
    test_rollouts: number;
  };
}

// Database entity types (matching Prisma models)
export interface DBFlag {
  id: string;
  key: string;
  displayName: string;
  type: FlagType;
  description?: string;
  defaultValues: {
    development: FlagValue;
    staging: FlagValue;
    production: FlagValue;
  };
  variants: {
    development: ConditionalVariant[];
    staging: ConditionalVariant[];
    production: ConditionalVariant[];
  };
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  appId: string;
}

export interface ConditionalVariant {
  id: string;
  name: string;
  conditions: Condition[];
  value: FlagValue;
  order: number;
}

export interface DBCohort {
  id: string;
  key: string;
  name: string;
  description?: string;
  conditions: Condition[];
  createdAt: string;
  updatedAt: string;
  appId: string;
}

export interface DBTestRollout {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: 'TEST' | 'ROLLOUT';
  salt: string;
  conditions: Condition[];
  variants?: Record<string, TestVariant>;
  percentage?: number;
  rolloutValues?: {
    development: FlagValue;
    staging: FlagValue;
    production: FlagValue;
  };
  flagIds: string[];
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  appId: string;
}

export interface PublicKey {
  kid: string;
  pem: string;
}

export interface FetchPolicy {
  min_interval_seconds: number;
  hard_ttl_days: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'schema' | 'reference' | 'type' | 'format';
  field: string;
  message: string;
}

export interface ValidationWarning {
  type: 'unreachable' | 'deprecated' | 'performance';
  field: string;
  message: string;
}

export interface PublishRequest {
  config: ConfigArtifact;
  changelog?: string;
}

export interface AuditLog {
  id: string;
  app_identifier: string;
  config_version: string;
  published_at: string;
  published_by: string;
  changelog?: string;
  diff: ConfigDiff;
}

export interface ConfigDiff {
  added_flags: string[];
  modified_flags: string[];
  removed_flags: string[];
  added_cohorts: string[];
  modified_cohorts: string[];
  removed_cohorts: string[];
  added_test_rollouts: string[];
  modified_test_rollouts: string[];
  removed_test_rollouts: string[];
}

// UI-specific types for flag management
export interface FlagListItem extends DBFlag {
  testRollouts?: {
    development: TestRollout[];
    staging: TestRollout[];
    production: TestRollout[];
  };
}

// Form types for creating/editing
export interface CreateFlagRequest {
  key: string;
  displayName: string;
  type: FlagType;
  description?: string;
  defaultValues: {
    development: FlagValue;
    staging: FlagValue;
    production: FlagValue;
  };
  appId: string;
}

export interface CreateTestRequest {
  key: string;
  name: string;
  description?: string;
  conditions: Condition[];
  variantCount: number; // 2 for A/B, 3 for A/B/C, etc.
  trafficSplit: number[]; // [50, 50] or [33, 33, 34]
  appId: string;
}

export interface CreateRolloutRequest {
  key: string;
  name: string;
  description?: string;
  conditions: Condition[];
  percentage: number;
  appId: string;
}

export interface CreateCohortRequest {
  key: string;
  name: string;
  description?: string;
  conditions: Condition[];
  appId: string;
}