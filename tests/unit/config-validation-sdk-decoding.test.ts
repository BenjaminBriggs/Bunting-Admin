import { validateConfig } from '@/lib/config-validation';

const boolFlag = (variants: unknown[] = []) => ({
	type: 'bool',
	development: { default: false },
	beta: { default: false },
	production: { default: false, variants },
});

describe('validateConfig: SDK decoding round-trip', () => {
	it('accepts a config every SDK decodes losslessly', () => {
		const result = validateConfig({
			schema_version: 1,
			config_version: '',
			published_at: '',
			app_identifier: 'app',
			flags: { 'a/b': boolFlag() },
			tests: {},
			rollouts: {},
		});
		expect(result.errors).toEqual([]);
	});

	it('rejects test groups summing to more than 100', () => {
		const result = validateConfig({
			flags: {},
			tests: {
				exp: {
					name: 'exp',
					type: 'test',
					salt: 's',
					conditions: [],
					groups: [
						{ name: 'a', percentage: 60 },
						{ name: 'b', percentage: 60 },
					],
				},
			},
		});
		expect(result.errors).toEqual([
			expect.objectContaining({
				type: 'dropped_test',
				message: expect.stringContaining('sum to 120'),
			}),
		]);
	});

	it('rejects a fractional rollout percentage', () => {
		const result = validateConfig({
			flags: {},
			rollouts: {
				r: {
					name: 'r',
					type: 'rollout',
					salt: 's',
					conditions: [],
					percentage: 12.5,
				},
			},
		});
		expect(result.errors.map((e) => e.type)).toEqual(['dropped_rollout']);
	});

	it('rejects a date-only date value, which SDKs cannot decode', () => {
		const result = validateConfig({
			flags: {
				'a/d': {
					type: 'date',
					development: { default: '2026-07-02' },
					beta: { default: '2026-07-02' },
					production: { default: '2026-07-02' },
				},
			},
		});
		expect(result.errors).toEqual([
			expect.objectContaining({ type: 'skipped_flag', flagKey: 'a/d' }),
		]);
	});

	it('does not repeat an error already reported for the same flag', () => {
		const result = validateConfig({
			flags: {
				'a/b': { ...boolFlag(), type: 'boolean' },
			},
		});
		expect(result.errors.map((e) => e.type)).toEqual(['invalid_type']);
	});
});
