import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateConfigFromDb } from '@/lib/config-generator';

const validateConfigSchema = z.object({
  appId: z.string(),
});

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

// POST /api/config/validate - Validate current configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId } = validateConfigSchema.parse(body);

    // Generate current config
    const config = await generateConfigFromDb(appId);
    
    // Run validation
    const validation = validateConfig(config);

    return NextResponse.json(validation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    console.error('Error validating config:', error);
    return NextResponse.json({ error: 'Failed to validate configuration' }, { status: 500 });
  }
}

function validateConfig(config: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate flags
  Object.entries(config.flags || {}).forEach(([key, flag]: [string, any]) => {
    // Check for environment-specific default values (schema v2)
    const environments = ['development', 'staging', 'production'];
    environments.forEach(env => {
      if (!flag[env] || flag[env].default === undefined || flag[env].default === null) {
        errors.push({
          type: 'missing_default',
          message: `Flag "${key}" is missing a default value for environment "${env}"`,
          flagKey: key
        });
      }
    });

    // Check for valid type
    if (!['bool', 'string', 'int', 'double', 'date', 'json'].includes(flag.type)) {
      errors.push({
        type: 'invalid_type',
        message: `Flag "${key}" has invalid type "${flag.type}"`,
        flagKey: key
      });
    }

    // Validate JSON flags for all environments
    if (flag.type === 'json') {
      environments.forEach(env => {
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
    environments.forEach(env => {
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

// Helper function to detect conflicting rule conditions
function hasConflictingConditions(rule1: any, rule2: any): boolean {
  // This is a simplified implementation
  // In a real scenario, this would be more sophisticated
  return false;
}