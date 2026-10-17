import {
	decodeArtifact,
	isLossless,
	isValidWireValue,
	UNRECOGNIZED,
} from '@/lib/artifact-decoder';

const header = {
	schema_version: 1,
	config_version: '2026-10-17.1',
	published_at: '2026-10-17T00:00:00.000Z',
	app_identifier: 'app',
};

const env = (defaultValue: unknown, variants: unknown[] = []) => ({
	default: defaultValue,
	variants,
});

const flag = (
	type: string,
	defaultValue: unknown,
	variants: unknown[] = [],
) => ({
	type,
	development: env(defaultValue),
	beta: env(defaultValue),
	production: env(defaultValue, variants),
});

const decode = (body: Record<string, unknown>) =>
	decodeArtifact(JSON.stringify({ ...header, ...body }));

describe('isValidWireValue (C2: decode by declared type)', () => {
	it.each([
		['bool', true, true],
		['bool', 'true', false],
		['int', 2, true],
		['int', 2.5, false],
		['int', '2', false],
		['double', 3, true],
		['double', 2.5, true],
		['string', '[Beta] Hi', true],
		['string', '2026-01-01T00:00:00Z', true],
		['json', '42', true],
		['json', { a: 1 }, false],
		['date', '2026-07-02T10:00:04.796Z', true],
		['date', '2026-07-02T10:00:04Z', true],
		['date', '2026-07-02', false],
		['date', '2026-07-02T00:00:00+01:00', false],
		['date', '2026-07-02T10:00:04.5Z', true],
		['date', '2028-02-29T00:00:00Z', true],
		['date', '2026-02-29T00:00:00Z', false],
		['date', '2026-02-30T00:00:00Z', false],
		['date', '2026-07-02T24:00:00Z', false],
		['date', '2026-06-30T23:59:60Z', false],
		['date', '2026-07-02T00:00:00.123456Z', false],
	] as const)('%s %j → %s', (type, value, valid) => {
		expect(isValidWireValue(type, value)).toBe(valid);
	});
});

describe('decodeArtifact header (strict)', () => {
	it('rejects invalid JSON', () => {
		expect(decodeArtifact('{"schema_version":1,').accepted).toBe(false);
	});

	it('rejects an unsupported schema_version', () => {
		const result = decode({ schema_version: 2, flags: {} });
		expect(result.accepted).toBe(false);
		expect(result.rejection).toMatch(/schema_version/);
	});

	it('rejects a malformed tests container', () => {
		expect(decode({ flags: {}, tests: [] }).accepted).toBe(false);
	});

	it('accepts missing tests and rollouts', () => {
		const result = decode({ flags: {} });
		expect(result.accepted).toBe(true);
		expect(result.artifact?.tests).toEqual({});
		expect(result.artifact?.rollouts).toEqual({});
	});

	it('ignores unknown keys at every level', () => {
		const result = decode({
			future: 1,
			flags: { 'a/b': { ...flag('bool', false), owner: 'team' } },
		});
		expect(isLossless(result)).toBe(true);
	});
});

describe('decodeArtifact flags (C1)', () => {
	it('skips only the flag with an unknown type', () => {
		const result = decode({
			flags: { 'a/color': flag('color', 'red'), 'a/ok': flag('bool', true) },
		});
		expect(result.accepted).toBe(true);
		expect(Object.keys(result.artifact?.flags ?? {})).toEqual(['a/ok']);
		expect(result.skippedFlags).toEqual([
			{ path: 'flags["a/color"]', reason: 'unknown flag type "color"' },
		]);
	});

	it('skips a flag whose default does not match its type', () => {
		const result = decode({ flags: { 'a/n': flag('int', '5') } });
		expect(result.artifact?.flags).toEqual({});
		expect(result.skippedFlags).toHaveLength(1);
	});

	it('reports a skipped flag once, not the issues inside it', () => {
		const result = decode({
			flags: {
				'a/n': {
					type: 'int',
					development: env(1, [{ type: 'mystery', order: 1 }]),
					beta: env(1),
				},
			},
		});
		expect(result.skippedFlags).toHaveLength(1);
		expect(result.unrecognizedVariants).toHaveLength(0);
	});
});

describe('decodeArtifact variants and conditions (C1)', () => {
	const variants = (list: unknown[]) =>
		decode({ flags: { 'a/s': flag('string', 'd', list) } });

	it('keeps an unknown variant type as a placeholder at its order', () => {
		const result = variants([{ type: 'geo_fence', order: 3, value: 'x' }]);
		expect(result.artifact?.flags['a/s'].production.variants).toEqual([
			{ type: UNRECOGNIZED, order: 3 },
		]);
		expect(result.unrecognizedVariants).toHaveLength(1);
	});

	it('turns a variant with a mistyped value into a placeholder', () => {
		const result = variants([
			{ type: 'conditional', order: 1, value: 5, conditions: [] },
		]);
		expect(result.artifact?.flags['a/s'].production.variants?.[0].type).toBe(
			UNRECOGNIZED,
		);
	});

	it('drops a variant with no integer order', () => {
		const result = variants([{ type: 'conditional', value: 'x' }]);
		expect(result.artifact?.flags['a/s'].production.variants).toEqual([]);
		expect(result.droppedVariants).toHaveLength(1);
	});

	it('marks unknown condition types and operators as unrecognized', () => {
		const result = variants([
			{
				type: 'conditional',
				order: 1,
				value: 'x',
				conditions: [
					{ type: 'moon_phase', operator: 'in', values: ['full'] },
					{ type: 'platform', operator: 'regex', values: ['ios'] },
					{ type: 'build_number', operator: 'equals', values: [100] },
				],
			},
		]);
		const decoded = result.artifact?.flags['a/s'].production.variants?.[0];
		expect(decoded?.type).toBe('conditional');
		expect(decoded?.conditions?.map((c) => c.type)).toEqual([
			UNRECOGNIZED,
			UNRECOGNIZED,
			UNRECOGNIZED,
		]);
		expect(result.unrecognizedConditions).toHaveLength(3);
	});

	it('keeps absent conditions absent (vacuous match)', () => {
		const result = variants([{ type: 'conditional', order: 1, value: 'x' }]);
		expect(
			result.artifact?.flags['a/s'].production.variants?.[0],
		).not.toHaveProperty('conditions');
		expect(isLossless(result)).toBe(true);
	});
});

describe('decodeArtifact tests and rollouts (C1)', () => {
	const testWith = (groups: unknown) => ({
		name: 't',
		type: 'test',
		salt: 's',
		conditions: [],
		groups,
	});

	it('keeps groups summing to under 100', () => {
		const result = decode({
			flags: {},
			tests: { t: testWith([{ name: 'a', percentage: 30 }]) },
		});
		expect(result.artifact?.tests.t.groups).toEqual([
			{ name: 'a', percentage: 30 },
		]);
	});

	it.each([
		[
			'sum over 100',
			[
				{ name: 'a', percentage: 60 },
				{ name: 'b', percentage: 60 },
			],
		],
		['fractional percentage', [{ name: 'a', percentage: 12.5 }]],
		[
			'duplicate names',
			[
				{ name: 'a', percentage: 10 },
				{ name: 'a', percentage: 10 },
			],
		],
	])('drops a test with %s', (_label, groups) => {
		const result = decode({ flags: {}, tests: { t: testWith(groups) } });
		expect(result.artifact?.tests).toEqual({});
		expect(result.droppedTests).toHaveLength(1);
	});

	it.each([150, 12.5, -1])('drops a rollout with percentage %s', (pct) => {
		const result = decode({
			flags: {},
			rollouts: {
				r: {
					name: 'r',
					type: 'rollout',
					salt: 's',
					conditions: [],
					percentage: pct,
				},
			},
		});
		expect(result.artifact?.rollouts).toEqual({});
		expect(result.droppedRollouts).toHaveLength(1);
	});
});
