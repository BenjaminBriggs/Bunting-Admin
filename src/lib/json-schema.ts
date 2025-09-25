/**
 * JSON Schema for validating config artifacts
 * Based on JSON Spec lines 287-414
 */

export const configArtifactSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "schema_version": { "type": "integer", "const": 2 },
    "config_version": { "type": "string" },
    "published_at": { "type": "string", "format": "date-time" },
    "app_identifier": { "type": "string" },
    "cohorts": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "conditions": {
            "type": "array",
            "items": { "$ref": "#/definitions/condition" }
          }
        },
        "required": ["name", "conditions"]
      }
    },
    "flags": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": ["boolean", "string", "integer", "double", "date", "json"]
          },
          "description": { "type": "string" },
          "development": { "$ref": "#/definitions/environment" },
          "staging": { "$ref": "#/definitions/environment" },
          "production": { "$ref": "#/definitions/environment" }
        },
        "required": ["type", "development", "staging", "production"]
      }
    },
    "tests": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "type": { "type": "string", "const": "test" },
          "salt": { "type": "string" },
          "conditions": {
            "type": "array",
            "items": { "$ref": "#/definitions/condition" }
          }
        },
        "required": ["name", "type", "salt"]
      }
    },
    "rollouts": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "type": { "type": "string", "const": "rollout" },
          "salt": { "type": "string" },
          "conditions": {
            "type": "array",
            "items": { "$ref": "#/definitions/condition" }
          },
          "percentage": { "type": "integer", "minimum": 0, "maximum": 100 }
        },
        "required": ["name", "type", "salt", "percentage"]
      }
    }
  },
  "required": [
    "schema_version",
    "config_version",
    "published_at",
    "app_identifier",
    "cohorts",
    "flags",
    "tests",
    "rollouts"
  ],
  "definitions": {
    "environment": {
      "type": "object",
      "properties": {
        "default": {}, // Any type allowed for default value
        "variants": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "enum": ["conditional", "test", "rollout"]
              },
              "value": {}, // Any type allowed for variant value
              "order": { "type": "integer" },
              "conditions": {
                "type": "array",
                "items": { "$ref": "#/definitions/condition" }
              },
              "test": { "type": "string" },
              "rollout": { "type": "string" }
            },
            "required": ["type", "value", "order"],
            "allOf": [
              {
                "if": {
                  "properties": { "type": { "const": "conditional" } }
                },
                "then": {
                  "required": ["conditions"]
                }
              },
              {
                "if": {
                  "properties": { "type": { "const": "test" } }
                },
                "then": {
                  "required": ["test"]
                }
              },
              {
                "if": {
                  "properties": { "type": { "const": "rollout" } }
                },
                "then": {
                  "required": ["rollout"]
                }
              }
            ]
          }
        }
      },
      "required": ["default"]
    },
    "condition": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "type": {
          "type": "string",
          "enum": [
            "app_version",
            "os_version",
            "platform",
            "device_model",
            "region",
            "cohort",
            "custom_attribute"
          ]
        },
        "values": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1
        },
        "operator": {
          "type": "string",
          "enum": [
            "equals",
            "does_not_equals",
            "between",
            "greater_than_or_equal",
            "greater_than",
            "less_than",
            "less_than_or_equal",
            "in",
            "not_in",
            "custom"
          ]
        }
      },
      "required": ["id", "type", "values", "operator"]
    }
  }
};

/**
 * Validate a config artifact against the JSON Schema
 */
export function validateConfigArtifact(config: any): {
  valid: boolean;
  errors: string[];
} {
  // Note: This is a simplified validation
  // In production, you'd use a proper JSON Schema validator like Ajv
  const errors: string[] = [];

  // Check required top-level fields
  const requiredFields = [
    'schema_version',
    'config_version',
    'published_at',
    'app_identifier',
    'cohorts',
    'flags',
    'tests',
    'rollouts'
  ];

  for (const field of requiredFields) {
    if (!(field in config)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate schema version
  if (config.schema_version !== 2) {
    errors.push(`Invalid schema_version: expected 2, got ${config.schema_version}`);
  }

  // Validate config version format (YYYY-MM-DD.N)
  if (config.config_version && !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(config.config_version)) {
    errors.push(`Invalid config_version format: ${config.config_version}`);
  }

  // Validate published_at is ISO 8601
  if (config.published_at) {
    try {
      new Date(config.published_at).toISOString();
    } catch {
      errors.push(`Invalid published_at format: ${config.published_at}`);
    }
  }

  // Validate flag types
  if (config.flags) {
    const validFlagTypes = ['boolean', 'string', 'integer', 'double', 'date', 'json'];
    for (const [key, flag] of Object.entries(config.flags as any)) {
      if (flag && typeof flag === 'object') {
        if (!validFlagTypes.includes((flag as any).type)) {
          errors.push(`Invalid flag type for "${key}": ${(flag as any).type}`);
        }

        // Check required environments
        const environments = ['development', 'staging', 'production'];
        for (const env of environments) {
          if (!(env in flag)) {
            errors.push(`Flag "${key}" missing environment: ${env}`);
          }
        }
      }
    }
  }

  // Validate condition structure
  if (config.cohorts) {
    for (const [key, cohort] of Object.entries(config.cohorts as any)) {
      if (cohort && typeof cohort === 'object') {
        const c = cohort as any;
        if (!c.name) {
          errors.push(`Cohort "${key}" missing required field: name`);
        }
        if (!Array.isArray(c.conditions)) {
          errors.push(`Cohort "${key}" conditions must be an array`);
        } else {
          // Validate each condition
          c.conditions.forEach((condition: any, index: number) => {
            const conditionErrors = validateCondition(condition);
            conditionErrors.forEach(error => {
              errors.push(`Cohort "${key}" condition ${index}: ${error}`);
            });
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a single condition object
 */
function validateCondition(condition: any): string[] {
  const errors: string[] = [];

  const requiredFields = ['id', 'type', 'values', 'operator'];
  for (const field of requiredFields) {
    if (!(field in condition)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  const validTypes = [
    'app_version',
    'os_version',
    'platform',
    'device_model',
    'region',
    'cohort',
    'custom_attribute'
  ];

  if (condition.type && !validTypes.includes(condition.type)) {
    errors.push(`Invalid condition type: ${condition.type}`);
  }

  const validOperators = [
    'equals',
    'does_not_equals',
    'between',
    'greater_than_or_equal',
    'greater_than',
    'less_than',
    'less_than_or_equal',
    'in',
    'not_in',
    'custom'
  ];

  if (condition.operator && !validOperators.includes(condition.operator)) {
    errors.push(`Invalid operator: ${condition.operator}`);
  }

  if (condition.values && !Array.isArray(condition.values)) {
    errors.push('Values must be an array');
  } else if (condition.values && condition.values.length === 0) {
    errors.push('Values array cannot be empty');
  }

  return errors;
}

/**
 * Additional validation for naming rules per JSON Spec
 */
export function validateNamingRules(config: any): string[] {
  const errors: string[] = [];
  const keyPattern = /^[a-z_]+$/;
  const noLeadingTrailing = /^[a-z](?:[a-z_]*[a-z])?$/;

  // Validate flag keys
  if (config.flags) {
    for (const key of Object.keys(config.flags)) {
      if (!keyPattern.test(key)) {
        errors.push(`Flag key "${key}" violates naming rules: must contain only lowercase letters and underscores`);
      } else if (!noLeadingTrailing.test(key)) {
        errors.push(`Flag key "${key}" violates naming rules: cannot start or end with underscore`);
      } else if (key.length > 64) {
        errors.push(`Flag key "${key}" violates naming rules: cannot exceed 64 characters`);
      }
    }
  }

  // Validate cohort keys
  if (config.cohorts) {
    for (const key of Object.keys(config.cohorts)) {
      if (!keyPattern.test(key)) {
        errors.push(`Cohort key "${key}" violates naming rules: must contain only lowercase letters and underscores`);
      } else if (!noLeadingTrailing.test(key)) {
        errors.push(`Cohort key "${key}" violates naming rules: cannot start or end with underscore`);
      } else if (key.length > 64) {
        errors.push(`Cohort key "${key}" violates naming rules: cannot exceed 64 characters`);
      }
    }
  }

  // Validate test keys
  if (config.tests) {
    for (const key of Object.keys(config.tests)) {
      if (!keyPattern.test(key)) {
        errors.push(`Test key "${key}" violates naming rules: must contain only lowercase letters and underscores`);
      } else if (!noLeadingTrailing.test(key)) {
        errors.push(`Test key "${key}" violates naming rules: cannot start or end with underscore`);
      } else if (key.length > 64) {
        errors.push(`Test key "${key}" violates naming rules: cannot exceed 64 characters`);
      }
    }
  }

  // Validate rollout keys
  if (config.rollouts) {
    for (const key of Object.keys(config.rollouts)) {
      if (!keyPattern.test(key)) {
        errors.push(`Rollout key "${key}" violates naming rules: must contain only lowercase letters and underscores`);
      } else if (!noLeadingTrailing.test(key)) {
        errors.push(`Rollout key "${key}" violates naming rules: cannot start or end with underscore`);
      } else if (key.length > 64) {
        errors.push(`Rollout key "${key}" violates naming rules: cannot exceed 64 characters`);
      }
    }
  }

  return errors;
}