import guardian from '@guardian/eslint-config';
import nextPlugin from '@next/eslint-plugin-next';

const guardianConfigs = [
	...guardian.configs.recommended,
	...guardian.configs.jest,
	...guardian.configs.react,
];

// Reuse the exact plugin instances registered by @guardian/eslint-config so the
// existing-debt ratchet below can downgrade their rules without re-declaring
// (or conflicting with) those plugins.
const guardianPlugins = Object.assign(
	{},
	...guardianConfigs.map((c) => c.plugins).filter(Boolean),
);

export default [
	{
		ignores: [
			'**/.next/**',
			'**/node_modules/**',
			'.claude/**',
			'coverage/**',
			'next-env.d.ts',
			'playwright-report/**',
			'test-results/**',
		],
	},
	...guardianConfigs,
	{
		plugins: {
			'@next/next': nextPlugin,
		},
		rules: {
			...nextPlugin.configs.recommended.rules,
			...nextPlugin.configs['core-web-vitals'].rules,
			'react/no-unescaped-entities': 'off',
		},
	},
	{
		// TODO(guardian-alignment): existing-debt ratchet. These @guardian/eslint-config
		// rules currently have violations in the codebase (~1,800, dominated by the
		// `any`-driven no-unsafe-* family). They are downgraded to "warn" so the shared
		// config is adopted and `pnpm lint` is green, while NEW violations of any
		// currently-clean rule still fail. Fix these and promote back to "error" over time.
		//
		// Type-aware rules: scoped to TS files so they reuse the typed parser that
		// @guardian/eslint-config configures for them.
		files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
		plugins: guardianPlugins,
		rules: {
			'@typescript-eslint/no-base-to-string': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
			// Promoted out of the ratchet: 0 violations, and an unhandled async
			// (a forgotten await on a DB write / publish) is a real bug.
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'warn',
			'@typescript-eslint/no-redundant-type-constituents': 'warn',
			'@typescript-eslint/no-require-imports': 'warn',
			'@typescript-eslint/no-unnecessary-condition': 'warn',
			'@typescript-eslint/no-unsafe-argument': 'warn',
			'@typescript-eslint/no-unsafe-assignment': 'warn',
			'@typescript-eslint/no-unsafe-call': 'warn',
			'@typescript-eslint/no-unsafe-member-access': 'warn',
			'@typescript-eslint/no-unsafe-return': 'warn',
			// Honour the `_`-prefix convention for intentionally-unused bindings and
			// the `{ used, ...rest }` strip idiom. The base no-unused-vars is disabled
			// for TS files (below) so it doesn't double-report or false-flag types/enums.
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
			'@typescript-eslint/prefer-nullish-coalescing': 'warn',
			'@typescript-eslint/require-await': 'warn',
		},
	},
	{
		// Non-type-aware ratchet rules (apply to all linted files).
		plugins: guardianPlugins,
		rules: {
			'@eslint-community/eslint-comments/require-description': 'warn',
			'import/newline-after-import': 'warn',
			'import/no-cycle': 'warn',
			'import/order': 'warn',
			'no-case-declarations': 'warn',
			'no-undef': 'warn',
			'no-unused-vars': 'warn',
			'no-useless-escape': 'warn',
			'react-hooks/immutability': 'warn',
			'react-hooks/set-state-in-effect': 'warn',
		},
	},
	{
		// On TS files the base no-unused-vars is superseded by the type-aware
		// @typescript-eslint/no-unused-vars (configured above) — disable the base
		// rule here so it doesn't double-report or false-flag types/enums. Must come
		// last to win over the all-files ratchet block above.
		files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
		rules: {
			'no-unused-vars': 'off',
		},
	},
	{
		// Edge-safety guardrail. The edge middleware and every module it can reach
		// at runtime must NOT statically import Node-only code. The Prisma client
		// (@/lib/db → @prisma/adapter-pg → pg → node:util/types) and the pino logger
		// crash the edge runtime when bundled into middleware. This has regressed
		// twice (pino, then the Prisma 7 pg adapter). If one of these files truly
		// needs the client/logger, import it LAZILY inside a function via dynamic
		// import() — which this rule intentionally does not flag. See
		// src/lib/access-control.ts (getDb) for the pattern.
		files: [
			'src/middleware.ts',
			'src/lib/auth.ts',
			'src/lib/auth-session.ts',
			'src/lib/auth-env.ts',
			'src/lib/auth-proxy.ts',
			'src/lib/access-control.ts',
		],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{ name: 'pino', message: 'Node-only — not edge-safe.' },
						{ name: 'pg', message: 'Node-only — not edge-safe.' },
						{
							name: '@prisma/adapter-pg',
							message: 'Node-only — not edge-safe.',
						},
						{ name: '@prisma/client', message: 'Node-only — not edge-safe.' },
					],
					patterns: [
						{
							regex: '(^|/)(db|logger)$',
							message:
								'Edge-reachable module: do not statically import @/lib/db or @/lib/logger — they pull Node-only deps (pg, pino) into the edge bundle and crash it. Import lazily inside a function via dynamic import() instead (see access-control.ts getDb).',
						},
						{
							regex: '@/generated/prisma',
							message:
								'Edge-reachable module: do not import the generated Prisma client here; it pulls the pg driver into the edge bundle. Import @/lib/db lazily via dynamic import() instead.',
						},
					],
				},
			],
		},
	},
	{
		// Enforce the structured pino logger in server code: ban raw console.* in
		// libraries and API routes (it bypasses leveling and secret redaction).
		// Client components keep console (pino is Node-only); the edge-reachable
		// auth files and the logger wrapper are exempted below.
		files: ['src/lib/**/*.ts', 'src/app/api/**/*.{ts,tsx}'],
		rules: {
			'no-console': 'error',
		},
	},
	{
		// These can't use pino (edge-reachable, or the logger module itself), so
		// console is the correct sink here.
		files: [
			'src/lib/logger.ts',
			'src/lib/access-control.ts',
			'src/lib/auth.ts',
			'src/lib/auth-session.ts',
			'src/lib/auth-env.ts',
			'src/lib/auth-proxy.ts',
		],
		rules: {
			'no-console': 'off',
		},
	},
	{
		// Security guardrail: ban the raw-string Prisma query methods. Use the
		// tagged-template $queryRaw / $executeRaw (parameterised) instead — the
		// `Unsafe` variants interpolate strings and invite SQL injection.
		files: ['src/**/*.ts', 'src/**/*.tsx'],
		ignores: ['src/generated/**'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "CallExpression[callee.property.name='$queryRawUnsafe']",
					message:
						'Use the tagged-template $queryRaw (parameterised); $queryRawUnsafe risks SQL injection.',
				},
				{
					selector: "CallExpression[callee.property.name='$executeRawUnsafe']",
					message:
						'Use the tagged-template $executeRaw (parameterised); $executeRawUnsafe risks SQL injection.',
				},
			],
		},
	},
];
