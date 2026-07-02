// Core Bunting SDK and config artifact types

// JSON Spec compliant config artifact structure (Schema v1)
export interface ConfigArtifact {
	schema_version: 1;
	config_version: string;
	published_at: string;
	app_identifier: string;
	flags: Record<string, EnvironmentFlag>;
	tests: Record<string, Test>;
	rollouts: Record<string, Rollout>;
}

// Flag with environment-specific configurations
export interface EnvironmentFlag {
	type: FlagType;
	development: EnvironmentFlagConfig;
	beta: EnvironmentFlagConfig;
	production: EnvironmentFlagConfig;
	description?: string;
	archived?: boolean;
	archived_at?: string;
	// Present and true when the flag is archived: it remains in the artifact so
	// clients still resolve it, but SDK codegen marks the accessor deprecated.
	deprecated?: boolean;
}

export interface EnvironmentFlagConfig {
	default: FlagValue;
	variants?: FlagVariant[];
}

// JSON Spec compliant variant system
export interface FlagVariant {
	type: 'conditional' | 'test' | 'rollout';
	order: number;
	value?: FlagValue;

	// For conditional variants
	conditions?: Condition[];

	// For test variants: group-name → value map
	test?: string;
	values?: Record<string, FlagValue>;

	// For rollout variants
	rollout?: string;
}

export type FlagType = 'bool' | 'string' | 'int' | 'double' | 'date' | 'json';

// Attempted narrowing to `boolean | string | number` (json values are
// JSON-encoded strings on the wire per config-validation.ts and the
// publish-time validation gate in publish/route.ts — nothing should ever
// need a raw `object` here). Reverted: dropping `object` produces 6 distinct
// `tsc` errors across 5 UI components (variant-creator-modal.tsx,
// condition-creator-modal.tsx, flag-assignment-edit-modal.tsx, flag-row.tsx,
// flag-test-assignment-modal.tsx), several of which are genuine structural
// mismatches between differently-shaped `Record<string, FlagValue>` variant
// maps rather than simple call-site casts — fixing them safely needs each
// component's intended prop shape investigated individually, which is out
// of scope here. Left as `object` with this note rather than force through
// unverified type surgery across the UI.
export type FlagValue = boolean | string | number | object;

export type Environment = 'development' | 'beta' | 'production';

export type Platform =
	| 'iOS'
	| 'iPadOS'
	| 'macOS'
	| 'watchOS'
	| 'tvOS'
	| 'visionOS';

// JSON Spec compliant condition system — operators must exactly match SDK ConditionOperator raw values
export type ConditionType =
	| 'app_version'
	| 'os_version'
	| 'build_number'
	| 'platform'
	| 'device_model'
	| 'region'
	| 'language'
	| 'custom_attribute';

export type ConditionOperator =
	| 'equals'
	| 'does_not_equals' // plural — matches SDK raw value "does_not_equals"
	| 'in'
	| 'not_in'
	| 'greater_than'
	| 'less_than'
	| 'greater_than_or_equal'
	| 'less_than_or_equal'
	| 'between'
	| 'custom'; // for custom_attribute type only

export interface Condition {
	// Optional client-side handle only (React keys / legacy condition editors). It is NOT
	// part of evaluation and is not written into the published config artifact.
	id?: string;
	type: ConditionType;
	operator: ConditionOperator;
	// For 'between': [min, max]; for 'in'/'not_in': list of values;
	// for 'custom_attribute': [attributeName] (SDK reads values[0] as attribute name)
	values: string[];
}

// Operators supported per condition type — must match SDK evaluation logic
export const CONDITION_OPERATORS: Record<ConditionType, ConditionOperator[]> = {
	app_version: [
		'equals',
		'does_not_equals',
		'greater_than',
		'greater_than_or_equal',
		'less_than',
		'less_than_or_equal',
		'between',
	],
	os_version: [
		'equals',
		'does_not_equals',
		'greater_than',
		'greater_than_or_equal',
		'less_than',
		'less_than_or_equal',
		'between',
	],
	build_number: [
		'equals',
		'does_not_equals',
		'greater_than',
		'greater_than_or_equal',
		'less_than',
		'less_than_or_equal',
		'between',
	],
	platform: ['in', 'not_in'],
	device_model: ['in', 'not_in'],
	region: ['in', 'not_in'],
	language: ['in', 'not_in'],
	custom_attribute: ['custom'],
};

// Predefined options for list-based conditions
export const PLATFORM_OPTIONS = [
	{ value: 'iOS', label: 'iOS' },
	{ value: 'iPadOS', label: 'iPadOS' },
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
export interface TestGroup {
	name: string;
	percentage: number;
}

export interface Test {
	name: string;
	description?: string;
	type: 'test';
	salt: string;
	conditions: Condition[];
	groups?: TestGroup[]; // SDK uses groups to assign users to variants via deterministic bucketing
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
		beta: FlagValue;
		production: FlagValue;
	};
}

export interface FlagAssignment {
	flag_id: string;
	flag_key: string;
	values:
		| {
				development: FlagValue;
				beta: FlagValue;
				production: FlagValue;
		  }
		| Record<
				string,
				{
					// For tests with variants
					development: FlagValue;
					beta: FlagValue;
					production: FlagValue;
				}
		  >;
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
