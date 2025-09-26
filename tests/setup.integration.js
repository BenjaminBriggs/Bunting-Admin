const jose = require('node-jose');
require('@testing-library/jest-dom');

jest.mock('next/headers', () => ({
  cookies: () => new Map(),
  headers: () => new Map(),
}));

const { server } = require('./msw/server');
const { truncateAll } = require('./db-utils.ts');

// Increase timeout for tests
jest.setTimeout(30000);

// Deterministic Date.now for time-sensitive assertions
const realDateNow = Date.now;

// Global test state
global.testKeystore = null;

beforeAll(() => {
  Date.now = () => 1_700_000_000_000;
});

beforeAll(async () => {
  console.log('🚀 Setting up test environment...');

  try {
    // Create test signing keystore for JWS tests
    global.testKeystore = jose.JWK.createKeyStore();
    await global.testKeystore.generate('RSA', 2048, {
      alg: 'RS256',
      use: 'sig',
      kid: 'test-key-1'
    });
    console.log('✅ Test signing keys generated');

    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.TEST_MODE = 'true';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/bunting_test';

    console.log('✅ Test environment setup complete');
  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    throw error;
  }
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

afterEach(async () => {
  server.resetHandlers();
  await truncateAll();
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');

  try {
    // Clear global test state
    global.testKeystore = null;

    console.log('✅ Test environment cleanup complete');
  } catch (error) {
    console.error('❌ Failed to cleanup test environment:', error);
  }
});

afterAll(() => {
  server.close();
  Date.now = realDateNow;
});

// Global test utilities
global.expectToThrowAsync = async (asyncFn, errorMessage) => {
  let error = null;
  try {
    await asyncFn();
  } catch (err) {
    error = err;
  }
  expect(error).not.toBeNull();
  if (errorMessage) {
    expect(error.message).toContain(errorMessage);
  }
};

global.waitFor = async (condition, timeout = 5000, interval = 100) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
};

// Mock console methods to reduce test noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    // Only show errors in test output if they're not expected test errors
    const message = args.join(' ');
    if (!message.includes('Warning: Could not clean database') &&
        !message.includes('Could not reset sequences')) {
      originalConsoleError(...args);
    }
  };

  console.warn = (...args) => {
    // Suppress most warnings in test output
    const message = args.join(' ');
    if (message.includes('CRITICAL') || message.includes('FATAL')) {
      originalConsoleWarn(...args);
    }
  };
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Add custom matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    }

    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass: false,
    };
  },

  toBeValidISO8601Date(received) {
    const date = new Date(received);
    const pass = date.toString() !== 'Invalid Date' &&
                 date.toISOString() === received;

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ISO8601 date`,
        pass: true,
      };
    }

    return {
      message: () => `expected ${received} to be a valid ISO8601 date`,
      pass: false,
    };
  },

  toMatchVersionPattern(received) {
    const versionRegex = /^\d{4}-\d{2}-\d{2}\.\d+$/;
    const pass = versionRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to match version pattern YYYY-MM-DD.N`,
        pass: true,
      };
    }

    return {
      message: () => `expected ${received} to match version pattern YYYY-MM-DD.N`,
      pass: false,
    };
  }
});

console.log('📋 Test setup configuration loaded');
