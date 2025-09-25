/**
 * JSON Spec compliant flag evaluation algorithm
 * Based on "Flag evaluation walkthrough" section lines 500-551
 */

import { FlagVariant, Condition, Environment } from '@/types';
import { bucketFor } from '@/lib/bucketing';

export interface EvaluationContext {
  environment: Environment;
  localId: string;
  userAttributes: Record<string, any>;
}

export interface FlagEvaluationResult {
  value: any;
  variant?: FlagVariant;
  reason: 'default' | 'conditional' | 'test' | 'rollout';
}

/**
 * Evaluate a flag for a given environment and user context
 * Implements the exact algorithm from JSON Spec lines 502-511
 */
export async function evaluateFlag(
  flag: any, // EnvironmentFlag from artifact
  environment: Environment,
  context: EvaluationContext
): Promise<FlagEvaluationResult> {
  // Step 1: Load the environment object
  const envConfig = flag[environment];
  if (!envConfig) {
    throw new Error(`Environment ${environment} not found for flag`);
  }

  // Step 2: Sort variants by order ascending (lowest first)
  const variants = (envConfig.variants || []).sort((a: FlagVariant, b: FlagVariant) => a.order - b.order);

  // Step 3: Evaluate each variant in order
  for (const variant of variants) {
    if (variant.type === 'conditional') {
      // Conditional variant: evaluate all conditions
      if (await evaluateConditions(variant.conditions || [], context)) {
        return {
          value: variant.value,
          variant,
          reason: 'conditional'
        };
      }
    } else if (variant.type === 'test') {
      // Test variant: determine user's test group using deterministic bucketing
      const testName = variant.test;
      if (testName) {
        // Note: Test evaluation requires additional test configuration
        // This would need to be passed in or looked up
        console.warn(`Test variant evaluation not fully implemented: ${testName}`);
      }
    } else if (variant.type === 'rollout') {
      // Rollout variant: compute rollout bucket
      const rolloutName = variant.rollout;
      if (rolloutName) {
        // Note: Rollout evaluation requires additional rollout configuration
        // This would need to be passed in or looked up
        console.warn(`Rollout variant evaluation not fully implemented: ${rolloutName}`);
      }
    }
  }

  // Step 4: No variant matched, return default value
  return {
    value: envConfig.default,
    reason: 'default'
  };
}

/**
 * Evaluate all conditions (AND logic - all must pass)
 */
export async function evaluateConditions(
  conditions: Condition[],
  context: EvaluationContext
): Promise<boolean> {
  for (const condition of conditions) {
    if (!(await evaluateCondition(condition, context))) {
      return false; // Short-circuit on first failure
    }
  }
  return true; // All conditions passed
}

/**
 * Evaluate a single condition based on JSON Spec condition types
 */
export async function evaluateCondition(
  condition: Condition,
  context: EvaluationContext
): Promise<boolean> {
  const { type, operator, values } = condition;

  switch (type) {
    case 'app_version':
      return evaluateVersionCondition(
        context.userAttributes.app_version,
        operator,
        values
      );

    case 'os_version':
      return evaluateVersionCondition(
        context.userAttributes.os_version,
        operator,
        values
      );

    case 'platform':
      return evaluateListCondition(
        context.userAttributes.platform,
        operator,
        values
      );

    case 'device_model':
      return evaluateListCondition(
        context.userAttributes.device_model,
        operator,
        values
      );

    case 'region':
      return evaluateListCondition(
        context.userAttributes.region,
        operator,
        values
      );

    case 'cohort':
      return evaluateListCondition(
        context.userAttributes.cohort,
        operator,
        values
      );

    case 'custom_attribute':
      return evaluateCustomCondition(condition, context);

    default:
      console.warn(`Unknown condition type: ${type}`);
      return false;
  }
}

/**
 * Evaluate version-based conditions (app_version, os_version)
 */
function evaluateVersionCondition(
  userValue: string | undefined,
  operator: string,
  values: string[]
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
    case 'between':
      if (values.length < 2) return false;
      const minVersion = values[0];
      const maxVersion = values[1];
      return (
        compareVersions(userValue, minVersion) >= 0 &&
        compareVersions(userValue, maxVersion) <= 0
      );
    default:
      return false;
  }
}

/**
 * Evaluate list-based conditions (platform, device_model, etc.)
 */
function evaluateListCondition(
  userValue: string | undefined,
  operator: string,
  values: string[]
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
function evaluateCustomCondition(
  condition: Condition,
  context: EvaluationContext
): boolean {
  // Custom condition evaluation would be implemented by the SDK
  // This is a placeholder for the concept
  console.warn(`Custom condition evaluation not implemented: ${condition.id}`);
  return false;
}

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(part => parseInt(part, 10));
  const bParts = b.split('.').map(part => parseInt(part, 10));

  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;

    if (aPart < bPart) return -1;
    if (aPart > bPart) return 1;
  }

  return 0;
}

/**
 * Example usage and testing
 */
export async function testFlagEvaluation(): Promise<void> {
  const mockFlag = {
    type: 'boolean',
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
              operator: 'in'
            }
          ]
        }
      ]
    }
  };

  const context: EvaluationContext = {
    environment: 'development',
    localId: '550e8400-e29b-41d4-a716-446655440000',
    userAttributes: {
      region: 'EU',
      app_version: '1.2.0',
      platform: 'iOS'
    }
  };

  const result = await evaluateFlag(mockFlag, 'development', context);
  console.log('Evaluation result:', result);
  // Should return: { value: true, variant: {...}, reason: 'conditional' }
}