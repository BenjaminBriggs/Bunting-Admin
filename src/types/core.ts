// Core Bunting SDK and config artifact types

// JSON Spec compliant config artifact structure (Schema v1)
export interface ConfigArtifact {
  schema_version: 1;
  config_version: string;
  published_at: string;
  app_identifier: string;
  cohorts: Record<string, Cohort>;
  flags: Record<string, EnvironmentFlag>;
  tests: Record<string, Test>;
  rollouts: Record<string, Rollout>;
}

// Flag with environment-specific configurations
export interface EnvironmentFlag {
  type: FlagType;
  development: EnvironmentFlagConfig;
  staging: EnvironmentFlagConfig;
  production: EnvironmentFlagConfig;
  description?: string;
  archived?: boolean;
  archived_at?: string;
}

export interface EnvironmentFlagConfig {
  default: FlagValue;
  variants?: FlagVariant[];
}

// Cohorts are now pure condition groups (for database/UI)
export interface Cohort {
  name: string;
  description?: string;
  conditions: Condition[];
}

// JSON Spec compliant variant system
export interface FlagVariant {
  type: 'conditional' | 'test' | 'rollout';
  order: number;
  value: FlagValue;

  // For conditional variants
  conditions?: Condition[];

  // For test variants
  test?: string;

  // For rollout variants
  rollout?: string;
}

export type FlagType = 'boolean' | 'string' | 'integer' | 'double' | 'date' | 'json';

export type FlagValue = boolean | string | number | object;

export type Environment = 'development' | 'staging' | 'production';

export type Platform = 'iOS' | 'iPadOS' | 'macOS' | 'watchOS' | 'tvOS';

// JSON Spec compliant condition system
export type ConditionType = 'app_version' | 'os_version' | 'build_number' | 'platform' | 'device_model' | 'region' | 'locale' | 'cohort' | 'custom_attribute';

export type ConditionOperator = 'equals' | 'not_equals' | 'does_not_equal' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'greater_than_or_equal' | 'less_than_or_equal' | 'between' | 'regex_match' | 'is_in_cohort' | 'is_not_in_cohort' | 'custom';

export interface Condition {
  id: string;
  type: ConditionType;
  operator: ConditionOperator;
  values: string[]; // For 'between': [minVersion, maxVersion], for 'in': [item1, item2, ...]
  attribute?: string; // For custom attributes
}

// JSON Spec compliant operator mapping
export const CONDITION_OPERATORS: Record<ConditionType, ConditionOperator[]> = {
  app_version: ['equals', 'not_equals', 'does_not_equal', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
  os_version: ['equals', 'not_equals', 'does_not_equal', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
  build_number: ['equals', 'not_equals', 'does_not_equal', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
  platform: ['in', 'not_in'],
  device_model: ['in', 'not_in', 'contains', 'not_contains', 'starts_with', 'ends_with', 'regex_match'],
  region: ['in', 'not_in'],
  locale: ['in', 'not_in', 'equals', 'not_equals', 'does_not_equal'],
  cohort: ['is_in_cohort', 'is_not_in_cohort'],
  custom_attribute: ['custom']
};

// Predefined options for list-based conditions
export const PLATFORM_OPTIONS = [
  { value: 'iOS', label: 'iOS' },
  { value: 'macOS', label: 'macOS' },
  { value: 'watchOS', label: 'watchOS' },
  { value: 'tvOS', label: 'tvOS' },
  { value: 'visionOS', label: 'visionOS' },
];

export const REGION_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
  { value: 'AU', label: 'Australia' },
  // Add more country codes as needed
];

// JSON Spec compliant Tests and Rollouts
export interface Test {
  name: string;
  description?: string;
  type: 'test';
  salt: string;
  conditions: Condition[];
}

export interface Rollout {
  name: string;
  description?: string;
  type: 'rollout';
  salt: string;
  conditions: Condition[];
  percentage: number;
}

// Admin-specific unified interface for database
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

export interface ConditionalVariant {
  id: string;
  name: string;
  type: 'conditional'; // Explicit type for consistency
  conditions: Condition[];
  value: FlagValue;
  order: number;
}

export interface PublicKey {
  kid: string;
  pem: string;
}

export interface FetchPolicy {
  min_interval_seconds: number;
  hard_ttl_days: number;
}