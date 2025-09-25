const { faker } = require('@faker-js/faker');
const crypto = require('crypto');

// Set consistent seed for reproducible tests
faker.seed(12345);

class TestDataFactories {

  static createApp(overrides = {}) {
    return {
      name: faker.company.name(),
      identifier: faker.internet.domainWord().toLowerCase(),
      artifactUrl: faker.internet.url(),
      publicKeys: [
        {
          kid: faker.string.alphanumeric(8),
          pem: this.generateMockPublicKey()
        }
      ],
      fetchPolicy: {
        min_interval_seconds: 21600, // 6 hours
        hard_ttl_days: 7
      },
      storageConfig: {
        bucket: `bunting-configs-${faker.string.alphanumeric(8)}`,
        region: 'us-east-1',
        endpoint: 'https://s3.amazonaws.com'
      },
      ...overrides
    };
  }

  static createFlag(appId, overrides = {}) {
    const type = overrides.type || faker.helpers.arrayElement(['bool', 'string', 'int', 'double', 'date', 'json']);

    return {
      key: this.generateFlagKey(),
      displayName: faker.commerce.productName(),
      type: type,
      description: faker.lorem.sentence(),
      defaultValues: {
        development: this.generateDefaultValue(type),
        staging: this.generateDefaultValue(type),
        production: this.generateDefaultValue(type)
      },
      variants: {},
      appId: appId,
      archived: false,
      ...overrides
    };
  }

  static createCohort(appId, overrides = {}) {
    return {
      key: faker.internet.domainWord().toLowerCase(),
      name: faker.commerce.productName(),
      description: faker.lorem.sentence(),
      conditions: [
        {
          field: faker.helpers.arrayElement(['user_id', 'app_version', 'platform', 'country']),
          operator: faker.helpers.arrayElement(['eq', 'neq', 'gte', 'lte', 'in', 'contains']),
          value: faker.string.alphanumeric(8)
        }
      ],
      appId: appId,
      ...overrides
    };
  }

  static createTestRollout(appId, type = 'test', overrides = {}) {
    const baseData = {
      key: faker.internet.domainWord().toLowerCase(),
      name: faker.commerce.productName(),
      description: faker.lorem.sentence(),
      type: type,
      salt: faker.string.alphanumeric(16),
      conditions: [],
      appId: appId,
      flagIds: [],
      archived: false,
      ...overrides
    };

    if (type === 'test') {
      baseData.variants = {
        control: {
          percentage: 50,
          values: {
            development: false,
            staging: false,
            production: false
          }
        },
        variant_a: {
          percentage: 50,
          values: {
            development: true,
            staging: true,
            production: true
          }
        }
      };
    } else if (type === 'rollout') {
      baseData.percentage = faker.number.int({ min: 0, max: 100 });
      baseData.rolloutValues = {
        development: true,
        staging: true,
        production: true
      };
    }

    return baseData;
  }

  static createAuditLog(appId, overrides = {}) {
    const today = new Date().toISOString().split('T')[0];
    const increment = faker.number.int({ min: 1, max: 10 });

    return {
      configVersion: `${today}.${increment}`,
      publishedAt: new Date(),
      publishedBy: faker.internet.email(),
      changelog: faker.lorem.paragraph(),
      configDiff: {
        added: faker.number.int({ min: 0, max: 5 }),
        modified: faker.number.int({ min: 0, max: 3 }),
        deleted: faker.number.int({ min: 0, max: 1 })
      },
      artifactSize: faker.number.int({ min: 1000, max: 50000 }),
      appId: appId,
      ...overrides
    };
  }

  // Utility methods
  static generateFlagKey() {
    const namespace = faker.helpers.maybe(
      () => faker.internet.domainWord().toLowerCase(),
      { probability: 0.6 }
    );
    const name = faker.internet.domainWord().toLowerCase() + '_' +
                 faker.internet.domainWord().toLowerCase();

    return namespace ? `${namespace}/${name}` : name;
  }

  static generateDefaultValue(type) {
    switch (type) {
      case 'bool':
        return faker.datatype.boolean();
      case 'string':
        return faker.lorem.words(3);
      case 'int':
        return faker.number.int({ min: -1000, max: 1000 });
      case 'double':
        return parseFloat(faker.number.float({ min: -100, max: 100, fractionDigits: 3 }));
      case 'date':
        return faker.date.future().toISOString();
      case 'json':
        return JSON.stringify({
          key: faker.lorem.word(),
          value: faker.number.int({ min: 1, max: 100 }),
          enabled: faker.datatype.boolean()
        });
      default:
        return null;
    }
  }

  static generateMockPublicKey() {
    // Generate a mock PEM-formatted public key for testing
    return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${faker.string.alphanumeric(344)}
-----END PUBLIC KEY-----`;
  }

  // Create multiple entities
  static createMultipleFlags(appId, count = 5, overrides = {}) {
    return Array.from({ length: count }, (_, i) =>
      this.createFlag(appId, {
        ...overrides,
        key: `test_flag_${i}_${faker.string.alphanumeric(4)}`
      })
    );
  }

  static createMultipleCohorts(appId, count = 3, overrides = {}) {
    return Array.from({ length: count }, (_, i) =>
      this.createCohort(appId, {
        ...overrides,
        key: `test_cohort_${i}_${faker.string.alphanumeric(4)}`
      })
    );
  }

  // Generate deterministic data using seeds
  static withSeed(seed, generator) {
    const originalSeed = faker.seed();
    faker.seed(seed);
    const result = generator();
    faker.seed(originalSeed);
    return result;
  }
}

module.exports = TestDataFactories;