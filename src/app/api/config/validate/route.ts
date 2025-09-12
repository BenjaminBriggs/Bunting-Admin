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
    // Check for valid default values
    if (flag.default === undefined || flag.default === null) {
      errors.push({
        type: 'missing_default',
        message: `Flag "${key}" is missing a default value`,
        flagKey: key
      });
    }

    // Check for valid type
    if (!['bool', 'string', 'int', 'double', 'date', 'json'].includes(flag.type)) {
      errors.push({
        type: 'invalid_type',
        message: `Flag "${key}" has invalid type "${flag.type}"`,
        flagKey: key
      });
    }

    // Validate JSON flags
    if (flag.type === 'json' && typeof flag.default === 'string') {
      try {
        JSON.parse(flag.default);
      } catch {
        errors.push({
          type: 'invalid_json',
          message: `Flag "${key}" has invalid JSON default value`,
          flagKey: key
        });
      }
    }

    // Check rules
    if (flag.rules && Array.isArray(flag.rules)) {
      flag.rules.forEach((rule: any, ruleIndex: number) => {
        // Check for valid conditions
        if (!rule.conditions || !Array.isArray(rule.conditions) || rule.conditions.length === 0) {
          warnings.push({
            type: 'empty_rule',
            message: `Rule ${ruleIndex + 1} in flag "${key}" has no conditions`,
            flagKey: key
          });
        }

        // Check for cohort references
        rule.conditions?.forEach((condition: any) => {
          if (condition.type === 'cohort' && condition.values && Array.isArray(condition.values)) {
            condition.values.forEach((cohortKey: string) => {
              if (!config.cohorts[cohortKey]) {
                errors.push({
                  type: 'missing_cohort_reference',
                  message: `Flag "${key}" references missing cohort "${cohortKey}"`,
                  flagKey: key
                });
              }
            });
          }
        });

        // Check for unreachable rules (warning)
        if (ruleIndex > 0 && flag.rules.some((prevRule: any, prevIndex: number) => 
          prevIndex < ruleIndex && hasConflictingConditions(rule, prevRule))) {
          warnings.push({
            type: 'unreachable_rule',
            message: `Rule ${ruleIndex + 1} in flag "${key}" may be unreachable due to conflicting conditions`,
            flagKey: key
          });
        }
      });
    }
  });

  // Validate cohorts
  Object.entries(config.cohorts || {}).forEach(([key, cohort]: [string, any]) => {
    // Check percentage
    if (typeof cohort.percentage !== 'number' || cohort.percentage < 0 || cohort.percentage > 100) {
      errors.push({
        type: 'invalid_percentage',
        message: `Cohort "${key}" has invalid percentage: ${cohort.percentage}`,
        cohortKey: key
      });
    }

    // Check salt
    if (!cohort.salt || typeof cohort.salt !== 'string') {
      errors.push({
        type: 'missing_salt',
        message: `Cohort "${key}" is missing a salt value`,
        cohortKey: key
      });
    }
  });

  return { errors, warnings };
}

// Helper function to detect conflicting rule conditions
function hasConflictingConditions(rule1: any, rule2: any): boolean {
  // This is a simplified implementation
  // In a real scenario, this would be more sophisticated
  return false;
}