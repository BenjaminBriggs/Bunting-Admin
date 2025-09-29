// API request and response types

import { FlagType, FlagValue, Condition, TestRollout, ConfigArtifact } from './core';
import { DBFlag } from './database';

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
  variantNames: string[]; // ["Control", "New Design", "Alternative"]
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

export interface PublishRequest {
  config: ConfigArtifact;
  changelog?: string;
}