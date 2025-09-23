/**
 * Config Validation Unit Tests
 *
 * Tests the config validation logic without requiring a real database.
 * This should have caught the "boolean" vs "bool" type issue.
 */

const { validateConfig, isValidFlagType, validateFlagValue, getDefaultValueForType } = require('../../src/lib/config-validation');

describe('Config Validation', () => {

  describe('Flag Type Validation', () => {
    test('accepts valid flag types', () => {
      const validTypes = ['bool', 'string', 'int', 'double', 'date', 'json'];

      validTypes.forEach(type => {
        const config = {
          flags: {
            test_flag: {
              type: type,
              development: { default: getDefaultValueForType(type) },
              staging: { default: getDefaultValueForType(type) },
              production: { default: getDefaultValueForType(type) }
            }
          },
          cohorts: {}
        };

        const result = validateConfig(config);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('handles Prisma enum normalization correctly', () => {
      // Prisma returns uppercase enum values like 'BOOL', 'STRING', etc.
      // Our normalization should convert these to lowercase
      const { normalizeFlagType } = require('../../src/lib/config-validation');

      expect(normalizeFlagType('BOOL')).toBe('bool');
      expect(normalizeFlagType('STRING')).toBe('string');
      expect(normalizeFlagType('INT')).toBe('int');
      expect(normalizeFlagType('DOUBLE')).toBe('double');
      expect(normalizeFlagType('DATE')).toBe('date');
      expect(normalizeFlagType('JSON')).toBe('json');

      // Also handle already-lowercase values
      expect(normalizeFlagType('bool')).toBe('bool');
      expect(normalizeFlagType('string')).toBe('string');
    });

    test('rejects invalid flag types - THIS WOULD CATCH THE BOOLEAN BUG', () => {
      const invalidTypes = ['boolean', 'number', 'text', 'Boolean', 'BOOL', 'str'];

      invalidTypes.forEach(type => {
        const config = {
          flags: {
            test_flag: {
              type: type,
              development: { default: true },
              staging: { default: true },
              production: { default: true }
            }
          },
          cohorts: {}
        };

        const result = validateConfig(config);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].type).toBe('invalid_type');
        expect(result.errors[0].message).toContain(`invalid type "${type}"`);
        expect(result.errors[0].flagKey).toBe('test_flag');
      });
    });

    test('catches the specific "boolean" vs "bool" bug', () => {
      const config = {
        flags: {
          show_shoping_list: {
            type: 'boolean', // This is the bug!
            development: { default: true },
            staging: { default: false },
            production: { default: false }
          }
        },
        cohorts: {}
      };

      const result = validateConfig(config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('invalid_type');
      expect(result.errors[0].message).toBe('Flag "show_shoping_list" has invalid type "boolean"');
      expect(result.errors[0].flagKey).toBe('show_shoping_list');
    });
  });

  describe('Environment Default Values', () => {
    test('requires default values for all environments', () => {
      const config = {
        flags: {
          test_flag: {
            type: 'bool',
            development: { default: true },
            staging: { default: false }
            // Missing production default
          }
        },
        cohorts: {}
      };

      const result = validateConfig(config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('missing_default');
      expect(result.errors[0].message).toContain('production');
    });

    test('rejects null or undefined defaults', () => {
      const config = {
        flags: {
          test_flag: {
            type: 'string',
            development: { default: 'test' },
            staging: { default: null },
            production: { default: undefined }
          }
        },
        cohorts: {}
      };

      const result = validateConfig(config);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.some(e => e.message.includes('staging'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('production'))).toBe(true);
    });
  });

  describe('JSON Flag Validation', () => {
    test('validates JSON syntax in default values', () => {
      const config = {
        flags: {
          json_flag: {
            type: 'json',
            development: { default: '{"valid": "json"}' },
            staging: { default: '{invalid json}' },
            production: { default: '{"also": "valid"}' }
          }
        },
        cohorts: {}
      };

      const result = validateConfig(config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('invalid_json');
      expect(result.errors[0].message).toContain('staging');
    });
  });

  describe('Cohort Reference Validation', () => {
    test('detects missing cohort references', () => {
      const config = {
        flags: {
          test_flag: {
            type: 'bool',
            development: {
              default: false,
              variants: [{
                conditions: [{
                  type: 'cohort',
                  values: ['missing_cohort']
                }],
                value: true
              }]
            },
            staging: { default: false },
            production: { default: false }
          }
        },
        cohorts: {}
      };

      const result = validateConfig(config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('missing_cohort_reference');
      expect(result.errors[0].message).toContain('missing_cohort');
    });
  });

  describe('Cohort Validation', () => {
    test('prevents circular cohort references', () => {
      const config = {
        flags: {},
        cohorts: {
          test_cohort: {
            conditions: [{
              type: 'cohort',
              values: ['other_cohort']
            }]
          }
        }
      };

      const result = validateConfig(config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('circular_cohort_reference');
    });

    test('warns about empty cohorts', () => {
      const config = {
        flags: {},
        cohorts: {
          empty_cohort: {
            conditions: []
          }
        }
      };

      const result = validateConfig(config);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('empty_cohort');
    });
  });

  // Helper function to generate appropriate default values for each type
  function getDefaultValueForType(type) {
    switch (type) {
      case 'bool':
        return true;
      case 'string':
        return 'test';
      case 'int':
        return 42;
      case 'double':
        return 3.14;
      case 'date':
        return '2025-01-01T00:00:00.000Z';
      case 'json':
        return '{"test": "value"}';
      default:
        return null;
    }
  }
});