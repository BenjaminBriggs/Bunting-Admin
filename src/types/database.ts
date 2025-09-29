// Database entity types (matching Prisma models)

import { FlagType, FlagValue, ConditionalVariant, Condition, TestVariant, PublicKey, FetchPolicy } from './core';

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