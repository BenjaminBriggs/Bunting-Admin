// Core Bunting types matching the specification

export interface ConfigArtifact {
  schema_version: 1;
  config_version: string;
  published_at: string;
  app_identifier: string;
  cohorts: Record<string, Cohort>;
  flags: Record<string, Flag>;
  metadata?: Record<string, any>;
}

export interface Cohort {
  salt: string;
  percentage: number;
}

export interface Flag {
  type: FlagType;
  default: FlagValue;
  rules?: Rule[];
  description?: string;
  archived?: boolean;
  archived_at?: string;
}

export type FlagType = 'bool' | 'string' | 'int' | 'double' | 'date' | 'json';

export type FlagValue = boolean | string | number | object;

export interface Rule {
  when: RuleCondition;
  set: FlagValue;
}

export interface RuleCondition {
  env?: Environment | Environment[];
  app_version?: VersionCondition;
  build_number?: NumberCondition;
  os_major?: NumberCondition;
  platform?: Platform | Platform[];
  locale?: string;
  locale_prefix?: string;
  in_cohort?: string;
}

export type Environment = 'debug' | 'beta' | 'live';

export type Platform = 'iOS' | 'iPadOS' | 'macOS' | 'watchOS' | 'tvOS';

export interface VersionCondition {
  '=='?: string;
  '!='?: string;
  '>'?: string;
  '>='?: string;
  '<'?: string;
  '<='?: string;
}

export interface NumberCondition {
  '=='?: number;
  '!='?: number;
  '>'?: number;
  '>='?: number;
  '<'?: number;
  '<='?: number;
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
}