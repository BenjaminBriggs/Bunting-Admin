const { faker } = require('@faker-js/faker');

// Set seed for deterministic test data
faker.seed(12345);

/**
 * Mock data generators for tests
 */
class MockDataHelper {
  /**
   * Generate mock app data
   */
  static createMockApp(overrides = {}) {
    return {
      id: faker.string.uuid(),
      name: faker.company.name(),
      identifier: faker.internet.domainName(),
      artifactUrl: faker.internet.url(),
      publicKeys: [
        {
          kid: 'test-key-1',
          pem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----'
        }
      ],
      fetchPolicy: {
        min_interval_seconds: 21600,
        hard_ttl_days: 30
      },
      storageConfig: {
        bucket: 'bunting-configs',
        region: 'us-east-1'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * Generate mock flag data
   */
  static createMockFlag(appId, overrides = {}) {
    const key = overrides.key || faker.lorem.slug(2).replace('-', '_');

    return {
      id: faker.string.uuid(),
      key,
      displayName: overrides.displayName || this.generateDisplayName(key),
      type: overrides.type || 'BOOL',
      description: faker.lorem.sentence(),
      archived: false,
      archivedAt: null,
      defaultValues: overrides.defaultValues || {
        development: true,
        staging: true,
        production: false
      },
      variants: overrides.variants || {},
      appId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * Generate mock cohort data
   */
  static createMockCohort(appId, overrides = {}) {
    const key = overrides.key || faker.lorem.slug(2).replace('-', '_');

    return {
      id: faker.string.uuid(),
      key,
      name: overrides.name || this.generateDisplayName(key),
      description: faker.lorem.sentence(),
      conditions: overrides.conditions || [
        {
          field: 'user_id',
          operator: 'mod',
          value: 10
        }
      ],
      appId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * Generate mock rule data
   */
  static createMockRule(appId, overrides = {}) {
    const key = overrides.key || faker.lorem.slug(2).replace('-', '_');

    return {
      id: faker.string.uuid(),
      key,
      name: overrides.name || this.generateDisplayName(key),
      description: faker.lorem.sentence(),
      conditions: overrides.conditions || [
        {
          field: 'environment',
          operator: 'eq',
          value: 'development'
        }
      ],
      flagOverrides: overrides.flagOverrides || {
        'test_flag': true
      },
      priority: overrides.priority || 0,
      environment: overrides.environment || 'development',
      enabled: overrides.enabled !== false,
      appId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * Generate mock publication data
   */
  static createMockPublication(appId, overrides = {}) {
    const version = overrides.version || this.generateVersion();

    return {
      id: faker.string.uuid(),
      version,
      environment: overrides.environment || 'development',
      config: overrides.config || this.createMockConfig(appId),
      configSize: overrides.configSize || 1024,
      signature: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
      detachedSignature: 'eyJhbGciOiJSUzI1NiJ9..signature',
      keyId: 'test-key-1',
      algorithm: 'RS256',
      publishedAt: new Date(),
      publishedBy: 'test-user',
      status: 'published',
      appId,
      createdAt: new Date(),
      ...overrides
    };
  }

  /**
   * Generate mock config data
   */
  static createMockConfig(appId, overrides = {}) {
    return {
      version: this.generateVersion(),
      appId,
      environment: 'development',
      generatedAt: new Date().toISOString(),
      flags: {
        'test_flag': {
          key: 'test_flag',
          type: 'bool',
          defaultValue: true,
          displayName: 'Test Flag',
          description: 'A test flag'
        }
      },
      cohorts: {
        'test_cohort': {
          key: 'test_cohort',
          name: 'Test Cohort',
          description: 'A test cohort',
          conditions: [
            {
              field: 'user_id',
              operator: 'mod',
              value: 10
            }
          ]
        }
      },
      rules: [
        {
          key: 'test_rule',
          name: 'Test Rule',
          description: 'A test rule',
          conditions: [
            {
              field: 'environment',
              operator: 'eq',
              value: 'development'
            }
          ],
          flagOverrides: {
            'test_flag': false
          },
          priority: 0
        }
      ],
      metadata: {
        flagCount: 1,
        cohortCount: 1,
        ruleCount: 1
      },
      ...overrides
    };
  }

  /**
   * Generate display name from key
   */
  static generateDisplayName(key) {
    return key
      .split(/[/_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate version string
   */
  static generateVersion() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const timestamp = now.getTime();

    return `${year}-${month}-${day}.${timestamp}`;
  }

  /**
   * Get mock Prisma client with pre-configured responses
   */
  static getMockPrisma(overrides = {}) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Configure default mock responses
    if (overrides.apps) {
      prisma.app.findMany.mockResolvedValue(overrides.apps);
      if (overrides.apps.length > 0) {
        prisma.app.findUnique.mockResolvedValue(overrides.apps[0]);
      }
    }

    if (overrides.flags) {
      prisma.flag.findMany.mockResolvedValue(overrides.flags);
      if (overrides.flags.length > 0) {
        prisma.flag.findUnique.mockResolvedValue(overrides.flags[0]);
      }
    }

    if (overrides.cohorts) {
      prisma.cohort.findMany.mockResolvedValue(overrides.cohorts);
      if (overrides.cohorts.length > 0) {
        prisma.cohort.findUnique.mockResolvedValue(overrides.cohorts[0]);
      }
    }

    if (overrides.rules) {
      prisma.rule.findMany.mockResolvedValue(overrides.rules);
      if (overrides.rules.length > 0) {
        prisma.rule.findUnique.mockResolvedValue(overrides.rules[0]);
      }
    }

    if (overrides.publications) {
      prisma.publication.findMany.mockResolvedValue(overrides.publications);
      if (overrides.publications.length > 0) {
        prisma.publication.findUnique.mockResolvedValue(overrides.publications[0]);
      }
    }

    // Mock common operations
    prisma.app.create.mockImplementation(async (args) => {
      return { id: faker.string.uuid(), ...args.data };
    });

    prisma.flag.create.mockImplementation(async (args) => {
      return { id: faker.string.uuid(), ...args.data };
    });

    prisma.cohort.create.mockImplementation(async (args) => {
      return { id: faker.string.uuid(), ...args.data };
    });

    prisma.rule.create.mockImplementation(async (args) => {
      return { id: faker.string.uuid(), ...args.data };
    });

    prisma.publication.create.mockImplementation(async (args) => {
      return { id: faker.string.uuid(), ...args.data };
    });

    // Mock update operations
    prisma.app.update.mockImplementation(async (args) => {
      return { id: args.where.id, ...args.data };
    });

    prisma.flag.update.mockImplementation(async (args) => {
      return { id: args.where.id, ...args.data };
    });

    prisma.cohort.update.mockImplementation(async (args) => {
      return { id: args.where.id, ...args.data };
    });

    prisma.rule.update.mockImplementation(async (args) => {
      return { id: args.where.id, ...args.data };
    });

    // Mock count operations
    prisma.app.count.mockResolvedValue(1);
    prisma.flag.count.mockResolvedValue(0);
    prisma.cohort.count.mockResolvedValue(0);
    prisma.rule.count.mockResolvedValue(0);
    prisma.publication.count.mockResolvedValue(0);
    prisma.testRollout.count.mockResolvedValue(0);

    return prisma;
  }
}

module.exports = MockDataHelper;