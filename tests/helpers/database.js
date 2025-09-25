const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

/**
 * Enhanced Database Helper for JSON Spec Compliance Tests
 *
 * Provides utilities for setting up and cleaning up test databases
 * and creating test data for JSON Spec compliance testing.
 */
class DatabaseHelper {
  static prisma = null;

  /**
   * Setup test database connection
   */
  static async setupTestDatabase() {
    if (!this.prisma) {
      // Set test database URL to PostgreSQL test database
      process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ||
        'postgresql://admin:admin123@localhost:5432/bunting_test';

      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      });

      // Run migrations for test database
      await this.runMigrations();

      // Connect to database
      await this.prisma.$connect();
    }

    return this.prisma;
  }

  /**
   * Run database migrations for tests
   */
  static async runMigrations() {
    try {
      // Push database schema (for testing we use db:push instead of migrations)
      execSync('npx prisma db push --force-reset', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      });
      console.log('Test database schema pushed successfully');
    } catch (error) {
      console.error('Failed to push test database schema:', error);
      throw error;
    }
  }


  /**
   * Cleanup test database connection
   */
  static async cleanupTestDatabase() {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }

  /**
   * Clear all test data from database
   */
  static async clearTestData() {
    if (!this.prisma) return;

    await this.prisma.testRollout.deleteMany();
    await this.prisma.flag.deleteMany();
    await this.prisma.cohort.deleteMany();
    await this.prisma.app.deleteMany();
  }

  /**
   * Create a test app with minimal required data
   */
  static async createTestApp(overrides = {}) {
    const defaultApp = {
      name: 'Test App',
      identifier: 'com.test.app',
      artifactUrl: 'https://cdn.example.com/test/config.json',
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
      }
    };

    return await this.prisma.app.create({
      data: { ...defaultApp, ...overrides }
    });
  }

  /**
   * Create a test flag with JSON Spec compliant structure
   */
  static async createTestFlag(appId, overrides = {}) {
    const defaultFlag = {
      key: 'test_flag',
      displayName: 'Test Flag',
      type: 'BOOL',
      description: 'A test flag',
      defaultValues: {
        development: false,
        staging: false,
        production: false
      },
      variants: {
        development: [],
        staging: [],
        production: []
      },
      appId
    };

    return await this.prisma.flag.create({
      data: { ...defaultFlag, ...overrides }
    });
  }

}

module.exports = DatabaseHelper;