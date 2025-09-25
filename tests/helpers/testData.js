const { getTestDatabase } = require('./database');
const TestDataFactories = require('./factories');

class TestDataHelpers {

  static async createTestApp(identifier = null, overrides = {}) {
    const db = await getTestDatabase();

    const appData = TestDataFactories.createApp({
      identifier: identifier || `test_app_${Date.now()}`,
      ...overrides
    });

    const app = await db.prisma.app.create({
      data: appData
    });

    return app;
  }

  static async createTestFlag(appId, overrides = {}) {
    const db = await getTestDatabase();

    const flagData = TestDataFactories.createFlag(appId, overrides);

    const flag = await db.prisma.flag.create({
      data: flagData
    });

    return flag;
  }

  static async createTestFlags(appId, count = 5, overrides = {}) {
    const flags = [];

    for (let i = 0; i < count; i++) {
      const flag = await this.createTestFlag(appId, {
        ...overrides,
        key: `test_flag_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`
      });
      flags.push(flag);
    }

    return flags;
  }

  static async createTestCohort(appId, overrides = {}) {
    const db = await getTestDatabase();

    const cohortData = TestDataFactories.createCohort(appId, overrides);

    const cohort = await db.prisma.cohort.create({
      data: cohortData
    });

    return cohort;
  }

  static async createTestCohorts(appId, count = 3, overrides = {}) {
    const cohorts = [];

    for (let i = 0; i < count; i++) {
      const cohort = await this.createTestCohort(appId, {
        ...overrides,
        key: `test_cohort_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`
      });
      cohorts.push(cohort);
    }

    return cohorts;
  }

  static async createTestRollout(appId, type = 'test', flagIds = [], overrides = {}) {
    const db = await getTestDatabase();

    const rolloutData = TestDataFactories.createTestRollout(appId, type, {
      flagIds: JSON.stringify(flagIds),
      ...overrides
    });

    const rollout = await db.prisma.testRollout.create({
      data: rolloutData
    });

    return rollout;
  }

  static async createTestRules(flags, cohorts, environment = 'production') {
    const rules = [];

    // Create simple rules linking first few flags to first few cohorts
    const maxRules = Math.min(flags.length, cohorts.length, 3);

    for (let i = 0; i < maxRules; i++) {
      const flag = flags[i];
      const cohort = cohorts[i];

      // For testing, create a rule that overrides the flag's default value
      const overrideValue = this.generateOverrideValue(flag.type, flag.defaultValues[environment]);

      const rule = {
        flagId: flag.id,
        cohortId: cohort.id,
        environment: environment,
        value: overrideValue,
        priority: i + 1,
        enabled: true
      };

      rules.push(rule);
    }

    return rules;
  }

  static generateOverrideValue(type, defaultValue) {
    // Generate a different value from the default for testing rule overrides
    switch (type) {
      case 'bool':
        return !defaultValue;
      case 'string':
        return defaultValue === 'test' ? 'override' : 'test';
      case 'int':
        return defaultValue + 1;
      case 'double':
        return parseFloat((defaultValue + 1.1).toFixed(3));
      case 'date':
        const date = new Date(defaultValue);
        date.setDate(date.getDate() + 1);
        return date.toISOString();
      case 'json':
        const parsed = JSON.parse(defaultValue);
        return JSON.stringify({ ...parsed, override: true });
      default:
        return null;
    }
  }

  static async createCompleteTestSetup(appIdentifier = null, options = {}) {
    const {
      flagCount = 5,
      cohortCount = 3,
      createRules = true,
      environment = 'production'
    } = options;

    // Create test app
    const app = await this.createTestApp(appIdentifier);

    // Create test flags
    const flags = await this.createTestFlags(app.id, flagCount);

    // Create test cohorts
    const cohorts = await this.createTestCohorts(app.id, cohortCount);

    // Create rules if requested
    let rules = [];
    if (createRules) {
      rules = await this.createTestRules(flags, cohorts, environment);
    }

    return {
      app,
      flags,
      cohorts,
      rules
    };
  }

  static async waitForAsync(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static generateUniqueKey(prefix = 'test') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  static validateFlagSchema(flag) {
    expect(flag).toHaveProperty('id');
    expect(flag).toHaveProperty('key');
    expect(flag).toHaveProperty('type');
    expect(flag).toHaveProperty('defaultValues');
    expect(flag).toHaveProperty('appId');
    expect(flag).toHaveProperty('createdAt');

    // Validate key pattern
    expect(flag.key).toMatch(/^[a-z0-9_/]+$/);
    expect(flag.key.length).toBeGreaterThan(0);
    expect(flag.key.length).toBeLessThanOrEqual(100);

    // Validate type
    expect(['bool', 'string', 'int', 'double', 'date', 'json']).toContain(flag.type);

    // Validate defaultValues structure
    expect(flag.defaultValues).toHaveProperty('development');
    expect(flag.defaultValues).toHaveProperty('staging');
    expect(flag.defaultValues).toHaveProperty('production');
  }

  static validateCohortSchema(cohort) {
    expect(cohort).toHaveProperty('id');
    expect(cohort).toHaveProperty('key');
    expect(cohort).toHaveProperty('name');
    expect(cohort).toHaveProperty('conditions');
    expect(cohort).toHaveProperty('appId');
    expect(cohort).toHaveProperty('createdAt');

    // Validate conditions array
    expect(Array.isArray(cohort.conditions)).toBe(true);
    cohort.conditions.forEach(condition => {
      expect(condition).toHaveProperty('field');
      expect(condition).toHaveProperty('operator');
      expect(condition).toHaveProperty('value');
    });
  }

  static validateConfigJsonSchema(config, expectedVersion) {
    expect(config).toHaveProperty('schema_version', 2);
    expect(config).toHaveProperty('config_version', expectedVersion);
    expect(config).toHaveProperty('published_at');
    expect(config).toHaveProperty('app_identifier');
    expect(config).toHaveProperty('cohorts');
    expect(config).toHaveProperty('flags');

    // Validate published_at is ISO date
    expect(new Date(config.published_at).toISOString()).toBe(config.published_at);

    // Validate flags structure
    Object.values(config.flags).forEach(flag => {
      expect(flag).toHaveProperty('type');
      expect(flag).toHaveProperty('development');
      expect(flag).toHaveProperty('staging');
      expect(flag).toHaveProperty('production');

      expect(flag.development).toHaveProperty('default');
      expect(flag.staging).toHaveProperty('default');
      expect(flag.production).toHaveProperty('default');
    });

    // Validate cohorts structure
    Object.values(config.cohorts).forEach(cohort => {
      expect(cohort).toHaveProperty('conditions');
      expect(Array.isArray(cohort.conditions)).toBe(true);
    });
  }
}

module.exports = TestDataHelpers;