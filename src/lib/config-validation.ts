/**
 * Config Validation Utilities
 *
 * Extracted from API route to make validation logic testable without database.
 * This addresses the issue where invalid flag types like "boolean" weren't caught.
 */

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: string;
  message: string;
  flagKey?: string;
  cohortKey?: string;
}

export interface ValidationWarning {
  type: string;
  message: string;
  flagKey?: string;
  cohortKey?: string;
}

const VALID_FLAG_TYPES = ['bool', 'string', 'int', 'double', 'date', 'json'] as const;
const ENVIRONMENTS = ['development', 'staging', 'production'] as const;

export type ValidFlagType = typeof VALID_FLAG_TYPES[number];
export type Environment = typeof ENVIRONMENTS[number];

/**
 * Validates a complete configuration object for errors and warnings.
 * This is the core validation logic that should catch type mismatches.
 */
export function validateConfig(config: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate flags
  Object.entries(config.flags || {}).forEach(([key, flag]: [string, any]) => {
    // Check for environment-specific default values (schema v2)
    ENVIRONMENTS.forEach(env => {
      if (!flag[env] || flag[env].default === undefined || flag[env].default === null) {
        errors.push({
          type: 'missing_default',
          message: `Flag "${key}" is missing a default value for environment "${env}"`,
          flagKey: key
        });
      }
    });

    // Check for valid type - THIS IS CRITICAL FOR CATCHING TYPE BUGS
    if (!isValidFlagType(flag.type)) {
      errors.push({
        type: 'invalid_type',
        message: `Flag "${key}" has invalid type "${flag.type}"`,
        flagKey: key
      });
    }

    // Validate JSON flags for all environments
    if (flag.type === 'json') {
      ENVIRONMENTS.forEach(env => {
        if (flag[env] && typeof flag[env].default === 'string') {
          try {
            JSON.parse(flag[env].default);
          } catch {
            errors.push({
              type: 'invalid_json',
              message: `Flag "${key}" has invalid JSON default value for environment "${env}"`,
              flagKey: key
            });
          }
        }
      });
    }

    // Check variants and their conditions for each environment
    ENVIRONMENTS.forEach(env => {
      if (flag[env] && flag[env].variants && Array.isArray(flag[env].variants)) {
        flag[env].variants.forEach((variant: any, variantIndex: number) => {
          // Check for valid conditions
          if (!variant.conditions || !Array.isArray(variant.conditions) || variant.conditions.length === 0) {
            warnings.push({
              type: 'empty_variant',
              message: `Variant ${variantIndex + 1} in flag "${key}" (${env}) has no conditions`,
              flagKey: key
            });
          }

          // Check for cohort references
          variant.conditions?.forEach((condition: any) => {
            if (condition.type === 'cohort' && condition.values && Array.isArray(condition.values)) {
              condition.values.forEach((cohortKey: string) => {
                if (!config.cohorts[cohortKey]) {
                  errors.push({
                    type: 'missing_cohort_reference',
                    message: `Flag "${key}" (${env}) references missing cohort "${cohortKey}"`,
                    flagKey: key
                  });
                }
              });
            }
          });
        });
      }
    });
  });

  // Validate cohorts (schema v2 - rule-based)
  Object.entries(config.cohorts || {}).forEach(([key, cohort]: [string, any]) => {
    // Check that cohort has conditions
    if (!cohort.conditions || !Array.isArray(cohort.conditions) || cohort.conditions.length === 0) {
      warnings.push({
        type: 'empty_cohort',
        message: `Cohort "${key}" has no conditions`,
        cohortKey: key
      });
    }

    // Validate cohort conditions
    cohort.conditions?.forEach((condition: any, conditionIndex: number) => {
      if (!condition.type) {
        errors.push({
          type: 'invalid_condition',
          message: `Condition ${conditionIndex + 1} in cohort "${key}" is missing a type`,
          cohortKey: key
        });
      }

      // Prevent circular references - cohorts should not reference other cohorts
      if (condition.type === 'cohort') {
        errors.push({
          type: 'circular_cohort_reference',
          message: `Cohort "${key}" cannot reference other cohorts (condition ${conditionIndex + 1})`,
          cohortKey: key
        });
      }
    });
  });

  return { errors, warnings };
}

/**
 * Type guard to check if a string is a valid flag type.
 * This prevents bugs like "boolean" vs "bool".
 */
export function isValidFlagType(type: any): type is ValidFlagType {
  return typeof type === 'string' && VALID_FLAG_TYPES.includes(type as ValidFlagType);
}

/**
 * Validates a single flag's type and structure.
 */
export function validateFlag(flag: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!isValidFlagType(flag.type)) {
    errors.push({
      type: 'invalid_type',
      message: `Invalid flag type "${flag.type}". Must be one of: ${VALID_FLAG_TYPES.join(', ')}`,
    });
  }

  return { errors, warnings };
}

/**
 * Validates that a flag value matches its declared type.
 */
export function validateFlagValue(type: ValidFlagType, value: any): boolean {
  switch (type) {
    case 'bool':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'int':
      return Number.isInteger(value);
    case 'double':
      return typeof value === 'number' && !Number.isNaN(value);
    case 'date':
      return typeof value === 'string' && !isNaN(Date.parse(value));
    case 'json':
      if (typeof value !== 'string') return false;
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Normalizes Prisma enum values to lowercase for consistency.
 * Prisma returns "BOOL" but our validation expects "bool".
 */
export function normalizeFlagType(type: string): string {
  return type.toLowerCase();
}

/**
 * Generates appropriate default values for testing.
 */
export function getDefaultValueForType(type: ValidFlagType): any {
  switch (type) {
    case 'bool':
      return false;
    case 'string':
      return '';
    case 'int':
      return 0;
    case 'double':
      return 0.0;
    case 'date':
      return new Date().toISOString();
    case 'json':
      return '{}';
    default:
      return null;
  }
}