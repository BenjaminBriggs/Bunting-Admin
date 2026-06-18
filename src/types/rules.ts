// Targeting Rules Types for Bunting Feature Flags
// NOTE: These are legacy aliases - use types from core.ts for new code

import type { Condition } from './core';
import { ConditionOperator, ConditionType } from './core';

// Legacy aliases for backward compatibility
export type RuleConditionType =
	| 'app_version'
	| 'os_version'
	| 'build_number'
	| 'platform'
	| 'device_model'
	| 'region'
	| 'language'
	| 'custom_attribute';

// Keep in sync with ConditionOperator in core.ts — must match SDK raw values exactly
export type RuleOperator =
	| 'equals'
	| 'does_not_equals' // plural — matches SDK ConditionOperator.doesNotEquals raw value
	| 'in'
	| 'not_in'
	| 'greater_than'
	| 'less_than'
	| 'greater_than_or_equal'
	| 'less_than_or_equal'
	| 'between'
	| 'custom'; // For custom_attribute type only

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
	valueType: 'text' | 'number' | 'select' | 'multi-select';
	placeholder?: string;
	options?: Array<{ value: string; label: string }>;
}

export interface RuleValidationError {
	ruleId: string;
	conditionId?: string;
	message: string;
	type: 'error' | 'warning';
}

// Legacy aliases - use Condition from core.ts for new code
export type RuleCondition = Condition;
