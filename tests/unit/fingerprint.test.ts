import {
	bitWidth,
	crc8,
	decodeFingerprint,
	encodeFingerprint,
	FingerprintError,
} from '@/lib/fingerprint';
import type { ConfigArtifact } from '@/types/core';

// The sample artifact from docs/Config Fingerprint Examples.md, with the live
// env naming (development/beta/production).
const sample: ConfigArtifact = {
	schema_version: 1,
	config_version: '2026-06-17.2',
	published_at: '2026-06-17T22:13:33.607Z',
	app_identifier: 'feast-ios',
	flags: {
		show_store: {
			type: 'bool',
			description: '',
			development: { default: true, variants: [] },
			beta: { default: false, variants: [] },
			production: {
				default: false,
				variants: [
					{
						type: 'conditional',
						order: 1,
						value: true,
						conditions: [
							{
								id: '1781734249915-5f2xk48',
								type: 'build_number',
								values: ['1234'],
								operator: 'greater_than_or_equal',
							},
						],
					},
				],
			},
		},
	},
	tests: {},
	rollouts: {},
};

describe('fingerprint primitives', () => {
	it('bitWidth: single path costs 0 bits, grows by powers of two', () => {
		expect(bitWidth(1)).toBe(0);
		expect(bitWidth(2)).toBe(1);
		expect(bitWidth(3)).toBe(2);
		expect(bitWidth(4)).toBe(2);
		expect(bitWidth(5)).toBe(3);
	});

	it('crc8 matches the documented worked example (payload 0x1A → 0x46)', () => {
		expect(crc8([0x1a])).toBe(0x46);
	});

	// bitWidth must be bit-identical to the SDK's integer-math implementation
	// (ConfigFingerprint.bitWidth in bunting-sdk-swift) for every count, since the
	// admin decodes SDK-produced fingerprints. Math.ceil(Math.log2(count)) is prone
	// to float rounding right at powers of two on some engines/counts, so this
	// checks parity against the mathematically-correct expected width directly.
	function expectedBitWidth(count: number): number {
		if (count <= 1) {
			return 0;
		}
		let bits = 0;
		let n = count - 1;
		while (n > 0) {
			bits += 1;
			n >>= 1;
		}
		return bits;
	}

	it('matches the SDK integer-math width for counts 1..1025', () => {
		for (let count = 1; count <= 1025; count++) {
			expect(bitWidth(count)).toBe(expectedBitWidth(count));
		}
	});

	it('matches exactly at powers of two', () => {
		for (const count of [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]) {
			expect(bitWidth(count)).toBe(expectedBitWidth(count));
			// A power of two needs exactly log2(count) bits, not one more.
			expect(bitWidth(count)).toBe(Math.log2(count));
		}
	});
});

describe('decodeFingerprint — documented vectors', () => {
	const cases: Array<[string, string, boolean, string]> = [
		['2026-06-17.2.1070', 'development', true, 'development default'],
		['2026-06-17.2.146C', 'beta', false, 'beta default'],
		['2026-06-17.2.1848', 'production', false, 'production default'],
		['2026-06-17.2.1A46', 'production', true, 'conditional variant (order 1)'],
	];

	it.each(cases)('decodes %s', (code, env, value, reason) => {
		const result = decodeFingerprint(sample, code);
		expect(result.env).toBe(env);
		expect(result.flags.show_store.value).toBe(value);
		expect(result.flags.show_store.type).toBe('bool');
		expect(result.flags.show_store.reason).toBe(reason);
	});

	it('decode accepts surrounding whitespace', () => {
		expect(
			decodeFingerprint(sample, '  2026-06-17.2.1A46  ').flags.show_store.value,
		).toBe(true);
	});
});

describe('decodeFingerprint — errors', () => {
	it('rejects a version mismatch', () => {
		expect(() => decodeFingerprint(sample, '2099-01-01.1.1070')).toThrow(
			/version mismatch/,
		);
	});

	it('rejects a corrupt CRC', () => {
		// 1A46 is valid; flip the CRC byte.
		expect(() => decodeFingerprint(sample, '2026-06-17.2.1A47')).toThrow(
			/checksum mismatch/,
		);
	});

	it('rejects malformed hex', () => {
		expect(() => decodeFingerprint(sample, '2026-06-17.2.XYZ')).toThrow(
			/malformed/,
		);
	});

	it('rejects a missing payload', () => {
		expect(() => decodeFingerprint(sample, '2026-06-17.2')).toThrow(
			FingerprintError,
		);
	});
});

describe('encode/decode round-trip with tests and rollouts', () => {
	const artifact: ConfigArtifact = {
		schema_version: 1,
		config_version: '2026-06-18.1',
		published_at: '2026-06-18T00:00:00.000Z',
		app_identifier: 'feast-ios',
		flags: {
			// Sorted-key order is enforced by the codec; declare out of order on purpose.
			paywall_copy: {
				type: 'string',
				development: { default: 'control' },
				beta: { default: 'control' },
				production: {
					default: 'control',
					variants: [
						{
							type: 'test',
							order: 1,
							test: 'paywall_q3',
							values: { control: 'control', treatment: 'shiny' },
						},
					],
				},
			},
			new_nav: {
				type: 'bool',
				development: { default: false },
				beta: { default: false },
				production: {
					default: false,
					variants: [
						{ type: 'rollout', order: 1, value: true, rollout: 'new_nav_ramp' },
					],
				},
			},
		},
		tests: {
			paywall_q3: {
				name: 'paywall_q3',
				type: 'test',
				salt: 's',
				conditions: [],
				groups: [
					{ name: 'control', percentage: 50 },
					{ name: 'treatment', percentage: 50 },
				],
			},
		},
		rollouts: {
			new_nav_ramp: {
				name: 'new_nav_ramp',
				type: 'rollout',
				salt: 's',
				conditions: [],
				percentage: 20,
			},
		},
	};

	it('resolves a user in the test treatment group with the rollout enabled', () => {
		// paywall_copy paths: [default, control, treatment] → index 2 = treatment
		// new_nav paths: [default(false), rollout-in(true)] → index 1 = in
		const code = encodeFingerprint(artifact, 'production', {
			paywall_copy: 2,
			new_nav: 1,
		});
		const decoded = decodeFingerprint(artifact, code);

		expect(decoded.env).toBe('production');
		expect(decoded.flags.paywall_copy.value).toBe('shiny');
		expect(decoded.flags.paywall_copy.reason).toBe(
			'test "paywall_q3" group "treatment"',
		);
		expect(decoded.flags.new_nav.value).toBe(true);
		expect(decoded.flags.new_nav.reason).toBe('rollout "new_nav_ramp"');
	});

	it('resolves a user who fell through to defaults', () => {
		const code = encodeFingerprint(artifact, 'production', {});
		const decoded = decodeFingerprint(artifact, code);
		expect(decoded.flags.paywall_copy.value).toBe('control');
		expect(decoded.flags.paywall_copy.reason).toBe('production default');
		expect(decoded.flags.new_nav.value).toBe(false);
		expect(decoded.flags.new_nav.reason).toBe('production default');
	});
});
