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
	| 'ios'
	| 'android'
	| 'macos'
	| 'watchos'
	| 'tvos'
	| 'visionos'
	| 'web';

// JSON Spec compliant condition system — operators must exactly match SDK ConditionOperator raw values
export type ConditionType =
	| 'app_version'
	| 'os_version'
	| 'build_number'
	| 'platform'
	| 'device_class'
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
	device_class: ['in', 'not_in'],
	device_model: ['in', 'not_in'],
	region: ['in', 'not_in'],
	language: ['in', 'not_in'],
	custom_attribute: ['custom'],
};

// Custom attribute names that are SDK-populated rather than app-supplied — the
// SDK resolves these itself (see ConditionEvaluator.swift's `.customAttribute`
// case and flag-evaluation.ts's `evaluateCustomCondition`) instead of calling
// out to the app's custom attribute resolver callback. This mirrors the SDK's
// normative reserved-attribute list; keep both in sync if it ever grows beyond
// `manufacturer` (e.g. `apple`, `samsung`, `google`).
export const RESERVED_CUSTOM_ATTRIBUTES = ['manufacturer'];

export function isReservedCustomAttribute(name: string): boolean {
	return RESERVED_CUSTOM_ATTRIBUTES.includes(name);
}

// Composes/decomposes a custom_attribute condition's `values` array: values[0]
// is always the attribute name, values[1...] are the accepted values (only
// meaningful — and only shown in the UI — for reserved attributes).
export function splitCustomAttributeValues(values: string[]): {
	attributeName: string;
	acceptedValues: string[];
} {
	return { attributeName: values[0] ?? '', acceptedValues: values.slice(1) };
}

// Predefined options for list-based conditions. Values are the lowercase, exact-match
// wire values the SDKs compare against; labels are display-only.
export const PLATFORM_OPTIONS = [
	{ value: 'ios', label: 'iOS' },
	{ value: 'android', label: 'Android' },
	{ value: 'macos', label: 'macOS' },
	{ value: 'watchos', label: 'watchOS' },
	{ value: 'tvos', label: 'tvOS' },
	{ value: 'visionos', label: 'visionOS' },
	{ value: 'web', label: 'Web' },
];

export const DEVICE_CLASS_OPTIONS = [
	{ value: 'phone', label: 'Phone' },
	{ value: 'tablet', label: 'Tablet' },
	{ value: 'desktop', label: 'Desktop' },
	{ value: 'tv', label: 'TV' },
	{ value: 'watch', label: 'Watch' },
	{ value: 'headset', label: 'Headset' },
];

// Platform group tokens are stored on rules and expanded to concrete platform
// values by the config generator at publish time. Groups exist for `platform` only.
export const PLATFORM_GROUP_OPTIONS = [
	{ value: 'everything', label: 'Everything (all platforms)' },
	{ value: 'all_apple', label: 'All Apple platforms' },
];

export const PLATFORM_GROUP_EXPANSIONS: Record<string, Platform[]> = {
	everything: ['ios', 'android', 'macos', 'watchos', 'tvos', 'visionos', 'web'],
	all_apple: ['ios', 'macos', 'watchos', 'tvos', 'visionos'],
};

// Expand any platform group tokens in `values` to concrete platform values,
// passing concrete values through and de-duplicating while preserving order.
export function expandPlatformGroups(values: string[]): string[] {
	const out: string[] = [];
	for (const value of values) {
		const expansion = PLATFORM_GROUP_EXPANSIONS[value];
		if (expansion) {
			out.push(...expansion);
		} else {
			out.push(value);
		}
	}
	return [...new Set(out)];
}

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
