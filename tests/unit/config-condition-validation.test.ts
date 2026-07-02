import { validateConfig } from '@/lib/config-validation';

const baseFlag = (conditions: unknown[]) => ({
	type: 'bool',
	development: { default: false, variants: [] },
	beta: { default: false, variants: [] },
	production: {
		default: false,
		variants: [{ type: 'conditional', order: 1, value: true, conditions }],
	},
});

describe('validateConfig — condition values', () => {
	it('accepts lowercase platform and device_class values', () => {
		const config = {
			flags: {
				f: baseFlag([
					{ type: 'platform', operator: 'in', values: ['ios', 'macos'] },
					{ type: 'device_class', operator: 'in', values: ['tablet'] },
				]),
			},
			tests: {},
			rollouts: {},
		};
		expect(validateConfig(config).errors).toEqual([]);
	});

	it('rejects a capitalized/legacy platform value', () => {
		const config = {
			flags: {
				f: baseFlag([{ type: 'platform', operator: 'in', values: ['iPadOS'] }]),
			},
			tests: {},
			rollouts: {},
		};
		const errors = validateConfig(config).errors;
		expect(errors.some((e) => e.type === 'invalid_condition_value')).toBe(true);
	});

	it('rejects an unexpanded group token in the published config', () => {
		const config = {
			flags: {
				f: baseFlag([
					{ type: 'platform', operator: 'in', values: ['all_apple'] },
				]),
			},
			tests: {},
			rollouts: {},
		};
		expect(
			validateConfig(config).errors.some(
				(e) => e.type === 'invalid_condition_value',
			),
		).toBe(true);
	});

	it('rejects an unknown device_class value', () => {
		const config = {
			flags: {
				f: baseFlag([
					{ type: 'device_class', operator: 'in', values: ['phablet'] },
				]),
			},
			tests: {},
			rollouts: {},
		};
		expect(
			validateConfig(config).errors.some(
				(e) => e.type === 'invalid_condition_value',
			),
		).toBe(true);
	});

	it('validates conditions on tests and rollouts too', () => {
		const config = {
			flags: {},
			tests: {
				t: {
					name: 't',
					type: 'test',
					salt: 's',
					groups: [],
					conditions: [{ type: 'platform', operator: 'in', values: ['iOS'] }],
				},
			},
			rollouts: {},
		};
		expect(
			validateConfig(config).errors.some(
				(e) => e.type === 'invalid_condition_value',
			),
		).toBe(true);
	});
});
