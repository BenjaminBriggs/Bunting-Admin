const TestFlag = require('../models/TestFlag');
const TestCohort = require('../models/TestCohort');
const TestRule = require('../models/TestRule');

class ConfigGenerator {
  constructor(prisma) {
    this.prisma = prisma;
    this.flagModel = new TestFlag(prisma);
    this.cohortModel = new TestCohort(prisma);
    this.ruleModel = new TestRule(prisma);
  }

  /**
   * Generate complete configuration for an app and environment
   */
  async generateConfig(appId, environment = 'development') {
    // Validate environment
    const validEnvironments = ['development', 'staging', 'production'];
    if (!validEnvironments.includes(environment)) {
      throw new Error(`Invalid environment: ${environment}. Must be one of: ${validEnvironments.join(', ')}`);
    }

    // Verify app exists
    const app = await this.prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      throw new Error(`App with ID '${appId}' not found`);
    }

    // Get all entities for the app
    const [flags, cohorts, rules] = await Promise.all([
      this.flagModel.findByAppId(appId),
      this.cohortModel.findByAppId(appId),
      this.ruleModel.findByAppId(appId, environment)
    ]);

    // Generate configuration structure
    const config = {
      version: this.generateConfigVersion(),
      appId,
      environment,
      generatedAt: new Date().toISOString(),
      flags: this.serializeFlags(flags, environment),
      cohorts: this.serializeCohorts(cohorts),
      rules: this.serializeRules(rules),
      metadata: {
        flagCount: flags.length,
        cohortCount: cohorts.length,
        ruleCount: rules.filter(r => r.enabled).length,
        totalRules: rules.length
      }
    };

    // Validate generated config
    this.validateConfig(config);

    return config;
  }

  /**
   * Serialize flags for client consumption
   */
  serializeFlags(flags, environment) {
    const serialized = {};

    flags.forEach(flag => {
      if (flag.archived) {
        return; // Skip archived flags
      }

      const defaultValues = flag.defaultValues || {};
      const defaultValue = defaultValues[environment];

      if (defaultValue === undefined) {
        throw new Error(`Flag '${flag.key}' missing default value for environment '${environment}'`);
      }

      serialized[flag.key] = {
        key: flag.key,
        type: flag.type.toLowerCase(),
        defaultValue: this.serializeFlagValue(flag.type, defaultValue),
        displayName: flag.displayName,
        description: flag.description,
        variants: flag.variants || {}
      };
    });

    return serialized;
  }

  /**
   * Serialize flag value based on type
   */
  serializeFlagValue(type, value) {
    switch (type.toLowerCase()) {
      case 'bool':
        return Boolean(value);

      case 'string':
        return String(value);

      case 'int':
        return Number.isInteger(value) ? value : parseInt(value, 10);

      case 'double':
        return typeof value === 'number' ? value : parseFloat(value);

      case 'date':
        if (typeof value === 'string') {
          // Validate ISO8601 format
          const date = new Date(value);
          if (date.toString() === 'Invalid Date' || date.toISOString() !== value) {
            throw new Error(`Invalid date format: ${value}. Must be ISO8601.`);
          }
          return value;
        }
        throw new Error(`Date value must be ISO8601 string, got: ${typeof value}`);

      case 'json':
        if (typeof value === 'string') {
          // Validate JSON
          try {
            JSON.parse(value);
            return value;
          } catch (error) {
            throw new Error(`Invalid JSON value: ${error.message}`);
          }
        }
        throw new Error(`JSON value must be string, got: ${typeof value}`);

      default:
        throw new Error(`Unknown flag type: ${type}`);
    }
  }

  /**
   * Serialize cohorts for client consumption
   */
  serializeCohorts(cohorts) {
    const serialized = {};

    cohorts.forEach(cohort => {
      serialized[cohort.key] = {
        key: cohort.key,
        name: cohort.name,
        description: cohort.description,
        conditions: cohort.conditions || [],
        createdAt: cohort.createdAt.toISOString()
      };
    });

    return serialized;
  }

  /**
   * Serialize rules for client consumption
   */
  serializeRules(rules) {
    // Filter to enabled rules only and maintain priority order
    const enabledRules = rules
      .filter(rule => rule.enabled)
      .sort((a, b) => {
        // Higher priority first, then earlier creation time
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

    return enabledRules.map((rule, index) => ({
      key: rule.key,
      name: rule.name,
      description: rule.description,
      conditions: rule.conditions || [],
      flagOverrides: rule.flagOverrides || {},
      priority: rule.priority,
      evaluationOrder: index, // Client can use this for debugging
      createdAt: rule.createdAt.toISOString()
    }));
  }

  /**
   * Generate configuration version (timestamp-based)
   */
  generateConfigVersion() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const timestamp = now.getTime();

    return `${year}-${month}-${day}.${timestamp}`;
  }

  /**
   * Validate generated configuration
   */
  validateConfig(config) {
    // Check required top-level fields
    const requiredFields = ['version', 'appId', 'environment', 'generatedAt', 'flags', 'cohorts', 'rules', 'metadata'];
    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }

    // Validate version format
    if (!config.version || typeof config.version !== 'string') {
      throw new Error('Config version must be a non-empty string');
    }

    // Validate environment
    const validEnvironments = ['development', 'staging', 'production'];
    if (!validEnvironments.includes(config.environment)) {
      throw new Error(`Invalid config environment: ${config.environment}`);
    }

    // Validate generatedAt is valid ISO8601
    const generatedDate = new Date(config.generatedAt);
    if (generatedDate.toString() === 'Invalid Date') {
      throw new Error('Config generatedAt must be valid ISO8601 date');
    }

    // Validate flags structure
    if (typeof config.flags !== 'object' || config.flags === null) {
      throw new Error('Config flags must be an object');
    }

    // Validate each flag
    for (const [flagKey, flagData] of Object.entries(config.flags)) {
      this.validateConfigFlag(flagKey, flagData);
    }

    // Validate cohorts structure
    if (typeof config.cohorts !== 'object' || config.cohorts === null) {
      throw new Error('Config cohorts must be an object');
    }

    // Validate rules structure
    if (!Array.isArray(config.rules)) {
      throw new Error('Config rules must be an array');
    }

    // Validate metadata
    if (typeof config.metadata !== 'object' || config.metadata === null) {
      throw new Error('Config metadata must be an object');
    }

    // Check metadata consistency
    const actualFlagCount = Object.keys(config.flags).length;
    const actualCohortCount = Object.keys(config.cohorts).length;
    const actualRuleCount = config.rules.length;

    if (config.metadata.flagCount !== actualFlagCount) {
      throw new Error(`Metadata flag count mismatch: expected ${config.metadata.flagCount}, got ${actualFlagCount}`);
    }

    if (config.metadata.cohortCount !== actualCohortCount) {
      throw new Error(`Metadata cohort count mismatch: expected ${config.metadata.cohortCount}, got ${actualCohortCount}`);
    }

    if (config.metadata.ruleCount !== actualRuleCount) {
      throw new Error(`Metadata rule count mismatch: expected ${config.metadata.ruleCount}, got ${actualRuleCount}`);
    }
  }

  /**
   * Validate individual flag in config
   */
  validateConfigFlag(flagKey, flagData) {
    const requiredFlagFields = ['key', 'type', 'defaultValue'];
    for (const field of requiredFlagFields) {
      if (!(field in flagData)) {
        throw new Error(`Flag '${flagKey}' missing required field: ${field}`);
      }
    }

    if (flagData.key !== flagKey) {
      throw new Error(`Flag key mismatch: object key '${flagKey}' != flag.key '${flagData.key}'`);
    }

    // Validate flag type
    const validTypes = ['bool', 'string', 'int', 'double', 'date', 'json'];
    if (!validTypes.includes(flagData.type)) {
      throw new Error(`Flag '${flagKey}' has invalid type: ${flagData.type}`);
    }

    // Validate default value matches type
    const validation = TestFlag.validateTypeAndValue(flagData.type, flagData.defaultValue);
    if (!validation.valid) {
      throw new Error(`Flag '${flagKey}' default value validation failed: ${validation.error}`);
    }
  }

  /**
   * Calculate configuration size
   */
  calculateConfigSize(config) {
    return Buffer.byteLength(JSON.stringify(config), 'utf8');
  }

  /**
   * Generate minimal configuration (for size optimization)
   */
  async generateMinimalConfig(appId, environment = 'development') {
    const fullConfig = await this.generateConfig(appId, environment);

    // Remove optional fields to reduce size
    const minimalConfig = {
      version: fullConfig.version,
      appId: fullConfig.appId,
      environment: fullConfig.environment,
      flags: {},
      cohorts: {},
      rules: fullConfig.rules.map(rule => ({
        key: rule.key,
        conditions: rule.conditions,
        flagOverrides: rule.flagOverrides,
        priority: rule.priority
      }))
    };

    // Minimize flag data
    Object.entries(fullConfig.flags).forEach(([key, flag]) => {
      minimalConfig.flags[key] = {
        type: flag.type,
        defaultValue: flag.defaultValue
      };
    });

    // Minimize cohort data
    Object.entries(fullConfig.cohorts).forEach(([key, cohort]) => {
      minimalConfig.cohorts[key] = {
        conditions: cohort.conditions
      };
    });

    return minimalConfig;
  }

  /**
   * Generate configuration diff between versions
   */
  generateConfigDiff(oldConfig, newConfig) {
    const diff = {
      added: { flags: {}, cohorts: {}, rules: [] },
      modified: { flags: {}, cohorts: {}, rules: [] },
      removed: { flags: {}, cohorts: {}, rules: [] }
    };

    // Compare flags
    this.compareFlags(oldConfig.flags, newConfig.flags, diff);

    // Compare cohorts
    this.compareCohorts(oldConfig.cohorts, newConfig.cohorts, diff);

    // Compare rules
    this.compareRules(oldConfig.rules, newConfig.rules, diff);

    return diff;
  }

  /**
   * Compare flags between configurations
   */
  compareFlags(oldFlags, newFlags, diff) {
    // Find added and modified flags
    Object.entries(newFlags).forEach(([key, newFlag]) => {
      if (!(key in oldFlags)) {
        diff.added.flags[key] = newFlag;
      } else if (JSON.stringify(oldFlags[key]) !== JSON.stringify(newFlag)) {
        diff.modified.flags[key] = {
          old: oldFlags[key],
          new: newFlag
        };
      }
    });

    // Find removed flags
    Object.entries(oldFlags).forEach(([key, oldFlag]) => {
      if (!(key in newFlags)) {
        diff.removed.flags[key] = oldFlag;
      }
    });
  }

  /**
   * Compare cohorts between configurations
   */
  compareCohorts(oldCohorts, newCohorts, diff) {
    // Find added and modified cohorts
    Object.entries(newCohorts).forEach(([key, newCohort]) => {
      if (!(key in oldCohorts)) {
        diff.added.cohorts[key] = newCohort;
      } else if (JSON.stringify(oldCohorts[key]) !== JSON.stringify(newCohort)) {
        diff.modified.cohorts[key] = {
          old: oldCohorts[key],
          new: newCohort
        };
      }
    });

    // Find removed cohorts
    Object.entries(oldCohorts).forEach(([key, oldCohort]) => {
      if (!(key in newCohorts)) {
        diff.removed.cohorts[key] = oldCohort;
      }
    });
  }

  /**
   * Compare rules between configurations
   */
  compareRules(oldRules, newRules, diff) {
    const oldRuleMap = {};
    const newRuleMap = {};

    // Create maps for easier comparison
    oldRules.forEach(rule => { oldRuleMap[rule.key] = rule; });
    newRules.forEach(rule => { newRuleMap[rule.key] = rule; });

    // Find added and modified rules
    Object.entries(newRuleMap).forEach(([key, newRule]) => {
      if (!(key in oldRuleMap)) {
        diff.added.rules.push(newRule);
      } else if (JSON.stringify(oldRuleMap[key]) !== JSON.stringify(newRule)) {
        diff.modified.rules.push({
          key,
          old: oldRuleMap[key],
          new: newRule
        });
      }
    });

    // Find removed rules
    Object.entries(oldRuleMap).forEach(([key, oldRule]) => {
      if (!(key in newRuleMap)) {
        diff.removed.rules.push(oldRule);
      }
    });
  }
}

module.exports = ConfigGenerator;