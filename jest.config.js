/** @type {import('jest').Config} */
const sharedProjectConfig = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  transformIgnorePatterns: [
    'node_modules/(?!(@faker-js/faker|msw|@mswjs|until-async|jose)/)'
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};

module.exports = {
  verbose: true,
  coverageProvider: 'v8',
  collectCoverageFrom: ['src/lib/db.ts'],
  coveragePathIgnorePatterns: ['<rootDir>/src/app/'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 }
  },
  projects: [
    {
      ...sharedProjectConfig,
      displayName: 'unit',
      testMatch: [
        '<rootDir>/tests/unit/**/*.test.js',
        '<rootDir>/tests/unit/**/*.test.ts'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.unit.js'],
      testTimeout: 10000,
    },
    {
      ...sharedProjectConfig,
      displayName: 'integration',
      testMatch: [
        '<rootDir>/tests/integration/**/*.test.js',
        '<rootDir>/tests/integration/**/*.test.ts'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.integration.js'],
      testTimeout: 30000,
    },
  ],
};
