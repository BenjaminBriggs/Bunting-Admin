/**
 * JSON Spec compliant flag evaluation algorithm
 * Based on "Flag evaluation walkthrough" section lines 500-551
 *
 * Reference implementation mirroring the SDK's evaluation order. Evaluation is
 * synchronous: the admin has no async data source for it.
 */

import { logger } from '@/lib/logger';
import type {
	Condition,
	ConditionOperator,
	Environment,
	EnvironmentFlag,
	FlagValue,
	FlagVariant,
} from '@/types';

// Device/user attributes evaluated against conditions. The known keys are
// strings; the index signature allows custom attributes.
export interface UserAttributes {
	app_version?: string;
	os_version?: string;
	build_number?: string;
	language?: string;
	platform?: string;
	device_model?: string;
	region?: string;
	[key: string]: unknown;
}

export interface EvaluationContext {
	environment: Environment;
	localId: string;
	userAttributes: UserAttributes;
}

export interface FlagEvaluationResult {
	value: FlagValue;
	variant?: FlagVariant;
	reason: 'default' | 'conditional' | 'test' | 'rollout';
}

/**
 * Evaluate a flag for a given environment and user context
 * Implements the exact algorithm from JSON Spec lines 502-511
 */
export function evaluateFlag(
	flag: EnvironmentFlag,
	environment: Environment,
	context: EvaluationContext,
): FlagEvaluationResult {
	// Step 1: Load the environment object
	const envConfig = flag[environment];

	// Step 2: Sort variants by order ascending (lowest first)
	const variants = [...(envConfig.variants ?? [])].sort(
		(a, b) => a.order - b.order,
	);

	// Step 3: Evaluate each variant in order
	for (const variant of variants) {
		if (variant.type === 'conditional') {
			// Conditional variant: evaluate all conditions
			if (evaluateConditions(variant.conditions ?? [], context)) {
				return {
					value: variant.value ?? envConfig.default,
					variant,
					reason: 'conditional',
				};
			}
		} else if (variant.type === 'test') {
			// Test variant: determine user's test group using deterministic bucketing
			const testName = variant.test;
			if (testName) {
				// Note: Test evaluation requires additional test configuration
				// This would need to be passed in or looked up
				logger.warn(
					{ testName },
					'Test variant evaluation not fully implemented',
				);
			}
		} else {
			// Rollout variant: compute rollout bucket
			const rolloutName = variant.rollout;
			if (rolloutName) {
				// Note: Rollout evaluation requires additional rollout configuration
				// This would need to be passed in or looked up
				logger.warn(
					{ rolloutName },
					'Rollout variant evaluation not fully implemented',
				);
			}
		}
	}

	// Step 4: No variant matched, return default value
	return {
		value: envConfig.default,
		reason: 'default',
	};
}

/**
 * Evaluate all conditions (AND logic - all must pass)
 */
export function evaluateConditions(
	conditions: Condition[],
	context: EvaluationContext,
): boolean {
	for (const condition of conditions) {
		if (!evaluateCondition(condition, context)) {
			return false; // Short-circuit on first failure
		}
	}
	return true; // All conditions passed
}

/**
 * Evaluate a single condition based on JSON Spec condition types
 */
export function evaluateCondition(
	condition: Condition,
	context: EvaluationContext,
): boolean {
	const { type, operator, values } = condition;

	switch (type) {
		case 'app_version':
			return evaluateVersionCondition(
				context.userAttributes.app_version,
				operator,
				values,
			);

		case 'os_version':
			return evaluateVersionCondition(
				context.userAttributes.os_version,
				operator,
				values,
			);

		case 'build_number':
			return evaluateVersionCondition(
				context.userAttributes.build_number,
				operator,
				values,
			);

		case 'language':
			return evaluateListCondition(
				context.userAttributes.language,
				operator,
				values,
			);

		case 'platform':
			return evaluateListCondition(
				context.userAttributes.platform,
				operator,
				values,
			);

		case 'device_model':
			return evaluateListCondition(
				context.userAttributes.device_model,
				operator,
				values,
			);

		case 'region':
			return evaluateListCondition(
				context.userAttributes.region,
				operator,
				values,
			);

		case 'custom_attribute':
			return evaluateCustomCondition(condition);

		default:
			// All ConditionType values are handled above; this guards malformed
			// runtime data whose `type` escapes the union.
			logger.warn({ type: String(type) }, 'Unknown condition type');
			return false;
	}
}

/**
 * Evaluate version-based conditions (app_version, os_version)
 */
function evaluateVersionCondition(
	userValue: string | undefined,
	operator: ConditionOperator,
	values: string[],
): boolean {
	if (!userValue || values.length === 0) {
		return false;
	}

	const targetVersion = values[0];

	switch (operator) {
		case 'equals':
			return userValue === targetVersion;
		case 'does_not_equals':
			return userValue !== targetVersion;
		case 'greater_than':
			return compareVersions(userValue, targetVersion) > 0;
		case 'greater_than_or_equal':
			return compareVersions(userValue, targetVersion) >= 0;
		case 'less_than':
			return compareVersions(userValue, targetVersion) < 0;
		case 'less_than_or_equal':
			return compareVersions(userValue, targetVersion) <= 0;
		case 'between': {
			if (values.length < 2) {
				return false;
			}
			const minVersion = values[0];
			const maxVersion = values[1];
			return (
				compareVersions(userValue, minVersion) >= 0 &&
				compareVersions(userValue, maxVersion) <= 0
			);
		}
		default:
			return false;
	}
}

/**
 * Evaluate list-based conditions (platform, device_model, etc.)
 */
function evaluateListCondition(
	userValue: string | undefined,
	operator: ConditionOperator,
	values: string[],
): boolean {
	if (!userValue) {
		return false;
	}

	switch (operator) {
		case 'in':
			return values.includes(userValue);
		case 'not_in':
			return !values.includes(userValue);
		default:
			return false;
	}
}

/**
 * Evaluate custom conditions
 * Implementation is SDK-specific
 */
function evaluateCustomCondition(condition: Condition): boolean {
	// Custom condition evaluation would be implemented by the SDK
	// This is a placeholder for the concept
	logger.warn(
		{ type: condition.type, value: condition.values[0] ?? '' },
		'Custom condition evaluation not implemented',
	);
	return false;
}

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
	const aParts = a.split('.').map((part) => parseInt(part, 10));
	const bParts = b.split('.').map((part) => parseInt(part, 10));

	const maxLength = Math.max(aParts.length, bParts.length);

	for (let i = 0; i < maxLength; i++) {
		// Missing parts (i beyond length) and non-numeric parts (NaN) both count as
		// 0 — note `??` would not catch NaN, so guard explicitly.
		const aPart = Number.isFinite(aParts[i]) ? aParts[i] : 0;
		const bPart = Number.isFinite(bParts[i]) ? bParts[i] : 0;

		if (aPart < bPart) {
			return -1;
		}
		if (aPart > bPart) {
			return 1;
		}
	}

	return 0;
}

/**
 * Example usage and testing
 */
export function testFlagEvaluation(): void {
	const mockFlag: EnvironmentFlag = {
		type: 'bool',
		development: {
			default: false,
			variants: [
				{
					type: 'conditional',
					order: 1,
					value: true,
					conditions: [
						{
							id: 'region-eu',
							type: 'region',
							values: ['EU'],
							operator: 'in',
						},
					],
				},
			],
		},
		beta: { default: false, variants: [] },
		production: { default: false, variants: [] },
	};

	const context: EvaluationContext = {
		environment: 'development',
		localId: '550e8400-e29b-41d4-a716-446655440000',
		userAttributes: {
			region: 'EU',
			app_version: '1.2.0',
			platform: 'iOS',
		},
	};

	const result = evaluateFlag(mockFlag, 'development', context);
	logger.info({ result }, 'Evaluation result');
	// Should return: { value: true, variant: {...}, reason: 'conditional' }
}
