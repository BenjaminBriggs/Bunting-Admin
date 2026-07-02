import {
	evaluateCondition,
	evaluateFlag,
	type EvaluationContext,
} from '@/lib/flag-evaluation';
import type { EnvironmentFlag, Rollout, Test } from '@/types';

// Pinned bucketing vectors (bucketFor('test-salt', <id>)): user-123 -> 27,
// user-456 -> 35. See tests/unit/bucketing.test.ts and the conformance bundle
// for the same pins.
const ctx = (
	localId: string,
	overrides: Partial<EvaluationContext['userAttributes']> = {},
): EvaluationContext => ({
	environment: 'production',
	localId,
	userAttributes: { platform: 'ios', ...overrides },
});

describe('evaluateCondition — custom_attribute (reserved attributes)', () => {
	it('matches a reserved attribute present in the accepted list', () => {
		expect(
			evaluateCondition(
				{
					type: 'custom_attribute',
					operator: 'custom',
					values: ['manufacturer', 'apple'],
				},
				ctx('user-1', { reserved_attributes: { manufacturer: 'apple' } }),
			),
		).toBe(true);
	});

	it('does not match a reserved attribute outside the accepted list', () => {
		expect(
			evaluateCondition(
				{
					type: 'custom_attribute',
					operator: 'custom',
					values: ['manufacturer', 'apple'],
				},
				ctx('user-1', { reserved_attributes: { manufacturer: 'android' } }),
			),
		).toBe(false);
	});

	it('does not match when no reserved_attributes are present at all', () => {
		expect(
			evaluateCondition(
				{
					type: 'custom_attribute',
					operator: 'custom',
					values: ['manufacturer', 'apple'],
				},
				ctx('user-1'),
			),
		).toBe(false);
	});

	it('treats a non-reserved custom attribute as non-matching (no resolver)', () => {
		expect(
			evaluateCondition(
				{
					type: 'custom_attribute',
					operator: 'custom',
					values: ['loyalty_tier', 'gold'],
				},
				ctx('user-1', { reserved_attributes: { manufacturer: 'apple' } }),
			),
		).toBe(false);
	});
});

describe('evaluateFlag — test variant group assignment', () => {
	const test: Test = {
		name: 'checkout-test',
		type: 'test',
		salt: 'test-salt',
		conditions: [],
		groups: [
			{ name: 'control', percentage: 30 },
			{ name: 'treatment', percentage: 70 },
		],
	};

	const flag: EnvironmentFlag = {
		type: 'string',
		development: { default: 'default-value' },
		beta: { default: 'default-value' },
		production: {
			default: 'default-value',
			variants: [
				{
					type: 'test',
					order: 1,
					test: 'checkout-test',
					values: { control: 'control-value', treatment: 'treatment-value' },
				},
			],
		},
	};

	it('assigns bucket 27 (user-123) to the control group (cumulative 30)', () => {
		const result = evaluateFlag(flag, 'production', ctx('user-123'), {
			tests: { 'checkout-test': test },
			rollouts: {},
		});
		expect(result).toEqual({
			value: 'control-value',
			variant: flag.production.variants?.[0],
			reason: 'test',
		});
	});

	it('assigns bucket 35 (user-456) to the treatment group (cumulative 100)', () => {
		const result = evaluateFlag(flag, 'production', ctx('user-456'), {
			tests: { 'checkout-test': test },
			rollouts: {},
		});
		expect(result.value).toBe('treatment-value');
		expect(result.reason).toBe('test');
	});

	it('falls through to the environment default when the test is missing from the artifact', () => {
		const result = evaluateFlag(flag, 'production', ctx('user-123'), {
			tests: {},
			rollouts: {},
		});
		expect(result).toEqual({ value: 'default-value', reason: 'default' });
	});
});

describe('evaluateFlag — rollout membership', () => {
	const rolloutIn: Rollout = {
		name: 'ship-it',
		type: 'rollout',
		salt: 'test-salt',
		conditions: [],
		percentage: 30, // bucket 27 (user-123) <= 30 -> enrolled
	};
	const rolloutOut: Rollout = {
		name: 'ship-it',
		type: 'rollout',
		salt: 'test-salt',
		conditions: [],
		percentage: 20, // bucket 27 (user-123) > 20 -> not enrolled
	};

	const flagFor = (rollout: Rollout): EnvironmentFlag => ({
		type: 'bool',
		development: { default: false },
		beta: { default: false },
		production: {
			default: false,
			variants: [
				{ type: 'rollout', order: 1, rollout: rollout.name, value: true },
			],
		},
	});

	it('enrolls a bucket within the rollout percentage', () => {
		const result = evaluateFlag(
			flagFor(rolloutIn),
			'production',
			ctx('user-123'),
			{ tests: {}, rollouts: { 'ship-it': rolloutIn } },
		);
		expect(result).toEqual({
			value: true,
			variant: flagFor(rolloutIn).production.variants?.[0],
			reason: 'rollout',
		});
	});

	it('excludes a bucket outside the rollout percentage', () => {
		const result = evaluateFlag(
			flagFor(rolloutOut),
			'production',
			ctx('user-123'),
			{ tests: {}, rollouts: { 'ship-it': rolloutOut } },
		);
		expect(result).toEqual({ value: false, reason: 'default' });
	});
});

describe('evaluateFlag — unchanged conditional/default behavior', () => {
	it('still returns the first matching conditional variant', () => {
		const flag: EnvironmentFlag = {
			type: 'bool',
			development: { default: false },
			beta: { default: false },
			production: {
				default: false,
				variants: [
					{
						type: 'conditional',
						order: 1,
						value: true,
						conditions: [{ type: 'region', operator: 'in', values: ['EU'] }],
					},
				],
			},
		};
		const result = evaluateFlag(
			flag,
			'production',
			ctx('user-123', { region: 'EU' }),
			{ tests: {}, rollouts: {} },
		);
		expect(result).toEqual({
			value: true,
			variant: flag.production.variants?.[0],
			reason: 'conditional',
		});
	});

	it('falls through to the default when nothing matches', () => {
		const flag: EnvironmentFlag = {
			type: 'bool',
			development: { default: false },
			beta: { default: false },
			production: { default: false, variants: [] },
		};
		const result = evaluateFlag(flag, 'production', ctx('user-123'), {
			tests: {},
			rollouts: {},
		});
		expect(result).toEqual({ value: false, reason: 'default' });
	});
});
