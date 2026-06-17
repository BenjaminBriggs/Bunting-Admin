/** @type {import('jest').Config} */
const sharedProjectConfig = {
	testEnvironment: 'node',
	testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
	// pnpm stores deps under node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>, so the
	// ESM packages we need Babel to transpile must be matched by their .pnpm dir name
	// (scopes use "+" instead of "/").
	transformIgnorePatterns: [
		'node_modules/.pnpm/(?!(jose|@faker-js\\+faker|msw|@mswjs\\+[^@/]+|until-async)@)',
	],
	transform: {
		'^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
	},
	moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};

module.exports = {
	verbose: true,
	coverageProvider: 'v8',
	collectCoverageFrom: ['src/lib/**/*.{ts,tsx}', '!src/lib/**/*.d.ts'],
	coveragePathIgnorePatterns: ['<rootDir>/src/app/'],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	// TODO(guardian-alignment): "don't regress" baseline. The gate previously only
	// watched src/lib/db.ts; it now reports on all of src/lib. Thresholds are set just
	// below current measured coverage (stmts/lines ~24%, branches ~75%, funcs ~43%) so
	// the gate is meaningful without blocking. Ratchet these up as lib coverage grows.
	coverageThreshold: {
		global: { branches: 70, functions: 40, lines: 22, statements: 22 },
	},
	projects: [
		{
			...sharedProjectConfig,
			displayName: 'unit',
			testMatch: [
				'<rootDir>/tests/unit/**/*.test.js',
				'<rootDir>/tests/unit/**/*.test.ts',
			],
			setupFilesAfterEnv: ['<rootDir>/tests/setup.unit.js'],
			testTimeout: 10000,
		},
		{
			...sharedProjectConfig,
			displayName: 'integration',
			testMatch: [
				'<rootDir>/tests/integration/**/*.test.js',
				'<rootDir>/tests/integration/**/*.test.ts',
			],
			setupFilesAfterEnv: ['<rootDir>/tests/setup.integration.js'],
			testTimeout: 30000,
		},
	],
};
