import { UNRECOGNIZED } from '@/lib/artifact-decoder';
import { enumeratePaths } from '@/lib/fingerprint';
import { evaluateFlag, type EvaluationContext } from '@/lib/flag-evaluation';
import type {
	ConfigArtifact,
	EnvironmentFlag,
	FlagVariant,
	Test,
} from '@/types';

// Pinned bucketing (bucketFor('test-salt', <id>)): user-123 -> 27,
// user-456 -> 35. See tests/unit/bucketing.test.ts.
const ctx = (localId: string): EvaluationContext => ({
	environment: 'production',
	localId,
	userAttributes: { platform: 'ios', region: 'US' },
});

const test = (groups: Test['groups']): Test => ({
	name: 'exp',
	type: 'test',
	salt: 'test-salt',
	conditions: [],
	groups,
});

const flagWith = (variants: FlagVariant[]): EnvironmentFlag => ({
	type: 'string',
	development: { default: 'default' },
	beta: { default: 'default' },
	production: { default: 'default', variants },
});

const testVariant: FlagVariant = {
	type: 'test',
	order: 1,
	test: 'exp',
	values: { a: 'a-value', b: 'b-value' },
};

const artifactWith = (t: Test) => ({ tests: { exp: t }, rollouts: {} });

describe('evaluateFlag: A/B test remainder (C3)', () => {
	it('serves the group value when the bucket lands in a group', () => {
		// user-123 buckets to 27, inside a's 30%.
		const result = evaluateFlag(
			flagWith([testVariant]),
			'production',
			ctx('user-123'),
			artifactWith(test([{ name: 'a', percentage: 30 }])),
		);
		expect(result).toMatchObject({ value: 'a-value', reason: 'test' });
	});

	it('falls through to the default when the bucket is past every group', () => {
		// user-123 buckets to 27, past a's 20%. Previously served a-value.
		const result = evaluateFlag(
			flagWith([testVariant]),
			'production',
			ctx('user-123'),
			artifactWith(test([{ name: 'a', percentage: 20 }])),
		);
		expect(result).toMatchObject({ value: 'default', reason: 'default' });
	});

	it('falls through to the next variant, not just the default', () => {
		const result = evaluateFlag(
			flagWith([
				testVariant,
				{
					type: 'conditional',
					order: 2,
					value: 'next',
					conditions: [{ type: 'region', operator: 'in', values: ['US'] }],
				},
			]),
			'production',
			ctx('user-123'),
			artifactWith(test([{ name: 'a', percentage: 20 }])),
		);
		expect(result).toMatchObject({ value: 'next', reason: 'conditional' });
	});

	it('falls through when the assigned group has no value in this variant', () => {
		// user-456 buckets to 35: past a (20), inside c (20 + 30 = 50).
		const result = evaluateFlag(
			flagWith([testVariant]),
			'production',
			ctx('user-456'),
			artifactWith(
				test([
					{ name: 'a', percentage: 20 },
					{ name: 'c', percentage: 30 },
				]),
			),
		);
		expect(result.reason).toBe('default');
	});

	it('never matches a groupless test', () => {
		const result = evaluateFlag(
			flagWith([{ ...testVariant, value: 'legacy' }]),
			'production',
			ctx('user-123'),
			artifactWith(test(undefined)),
		);
		expect(result.reason).toBe('default');
	});
});

describe('unrecognized variants from the decoder', () => {
	const placeholder = {
		type: UNRECOGNIZED,
		order: 1,
	} as unknown as FlagVariant;

	it('never match, so evaluation moves to the next variant', () => {
		const result = evaluateFlag(
			flagWith([
				placeholder,
				{ type: 'conditional', order: 2, value: 'second' },
			]),
			'production',
			ctx('user-123'),
			{ tests: {}, rollouts: {} },
		);
		expect(result).toMatchObject({ value: 'second', reason: 'conditional' });
	});

	it('count as one fingerprint path', () => {
		const flag = flagWith([
			placeholder,
			{ type: 'conditional', order: 2, value: 'second' },
		]);
		const artifact = {
			tests: {},
			rollouts: {},
			flags: { f: flag },
		} as unknown as ConfigArtifact;
		const paths = enumeratePaths(artifact, flag, 'production');
		expect(paths.map((p) => p.reason)).toEqual([
			'production default',
			'unrecognized variant (order 1)',
			'conditional variant (order 2)',
		]);
	});
});
