// Targeting Rules Types for Bunting Feature Flags
// NOTE: These are legacy aliases - use types from core.ts for new code

import { ConditionType, ConditionOperator, Condition } from './core';

// Legacy aliases for backward compatibility
export type RuleConditionType =
  | 'app_version'
  | 'os_version'
  | 'build_number'
  | 'platform'
  | 'device_model'
  | 'region'
  | 'locale'
  | 'cohort'
  | 'custom_attribute';

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'does_not_equal'  // SDK spec alias for not_equals
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'regex_match'
  | 'is_in_cohort'
  | 'is_not_in_cohort'
  | 'custom';  // For custom attributes


export interface TargetingRule {
  id: string;
  enabled: boolean;
  conditions: RuleCondition[];
  conditionLogic: 'AND' | 'OR'; // How to combine multiple conditions
  value: any; // The value to return when this rule matches
  priority: number; // Lower numbers = higher priority
}

// Cohort targeting rules don't have a return value - they just define membership criteria
export interface CohortTargetingRule {
  id: string;
  enabled: boolean;
  conditions: RuleCondition[];
  conditionLogic: 'AND' | 'OR'; // How to combine multiple conditions
  priority: number; // Lower numbers = higher priority
}

export interface FlagWithRules {
  id: string;
  key: string;
  displayName: string;
  type: 'bool' | 'string' | 'int' | 'double' | 'date' | 'json';
  defaultValue: any;
  description?: string;
  archived: boolean;
  rules: TargetingRule[];
  updatedAt: string;
}

// Helper types for UI
export interface ConditionTemplate {
  type: RuleConditionType;
  label: string;
  description: string;
  operators: RuleOperator[];
  valueType: 'text' | 'number' | 'select' | 'multi-select' | 'cohort';
  placeholder?: string;
  options?: { value: string; label: string; }[];
}

export interface RuleValidationError {
  ruleId: string;
  conditionId?: string;
  message: string;
  type: 'error' | 'warning';
}

// Legacy aliases - use Condition from core.ts for new code
export type RuleCondition = Condition;