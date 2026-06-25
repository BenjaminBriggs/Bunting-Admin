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
			'@typescript-eslint/no-floating-promises': 'warn',
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
];
