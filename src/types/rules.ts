// Targeting Rules Types for Bunting Feature Flags

export type RuleConditionType = 
  | 'environment'
  | 'app_version'
  | 'platform'
  | 'country'
  | 'cohort';

export type RuleOperator = 
  | 'equals'
  | 'not_equals'
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
  | 'regex_match'
  | 'is_in_cohort'
  | 'is_not_in_cohort';

export interface RuleCondition {
  id: string;
  type: RuleConditionType;
  operator: RuleOperator;
  values: string[];
  attribute?: string; // For custom attributes
}

export interface TargetingRule {
  id: string;
  enabled: boolean;
  conditions: RuleCondition[];
  conditionLogic: 'AND' | 'OR'; // How to combine multiple conditions
  value: any; // The value to return when this rule matches
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