import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const dir = join(process.cwd(), 'conformance');
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

describe('conformance bundle', () => {
	it('has a manifest listing the six sets with matching counts', () => {
		expect(existsSync(join(dir, 'manifest.json'))).toBe(true);
		const manifest = read('manifest.json');
		expect(Object.keys(manifest.sets).sort()).toEqual([
			'bootstrap',
			'bucketing',
			'decoding',
			'evaluation',
			'fingerprint',
			'signature',
		]);
		expect(typeof manifest.version).toBe('string');
		const sets: Record<string, { file: string; count: number }> = manifest.sets;
		for (const set of Object.values(sets)) {
			const file = read(set.file);
			expect(file.version).toBe(manifest.version);
			expect(file.cases).toHaveLength(set.count);
		}
	});

	it('decoding cases agree with the reference decoder', () => {
		const { decodeArtifact } = require('@/lib/artifact-decoder');
		const cases = read('decoding.json').cases as Array<{
			name: string;
			artifact_b64: string;
			expected: {
				accepted: boolean;
				flags?: Record<string, unknown>;
				skipped_flags?: string[];
			};
		}>;
		expect(cases.some((c) => c.expected.accepted)).toBe(true);
		expect(cases.some((c) => !c.expected.accepted)).toBe(true);
		for (const c of cases) {
			const text = Buffer.from(c.artifact_b64, 'base64').toString('utf8');
			const result = decodeArtifact(text);
			expect(result.accepted).toBe(c.expected.accepted);
			if (result.accepted) {
				expect(Object.keys(result.artifact.flags).sort()).toEqual(
					Object.keys(c.expected.flags ?? {}),
				);
				expect(result.skippedFlags).toHaveLength(
					c.expected.skipped_flags?.length ?? 0,
				);
			}
		}
	});

	it('evaluation pins the A/B remainder falling through (C3)', () => {
		const cases = read('evaluation.json').cases as Array<{
			flag_key: string;
			expected_source: string;
		}>;
		const sources = cases
			.filter((c) => c.flag_key === 'test/remainder_experiment')
			.map((c) => c.expected_source);
		expect(sources).toContain('conditional variant (order 2)');
		expect(sources.filter((s) => s.startsWith('test '))).toHaveLength(2);
	});

	it('bucketing vectors agree with bucketFor and cover >=100 swift-applicable UUID cases', () => {
		const { bucketFor } = require('@/lib/bucketing');
		const vectors = read('bucketing.json').cases as Array<{
			salt: string;
			identifier: string;
			bucket: number;
			swift_applicable?: boolean;
		}>;
		// Every case must match the reference bucketer (admin runs all of them).
		for (const v of vectors) {
			expect(bucketFor(v.salt, v.identifier)).toBe(v.bucket);
		}
		// The gate needs >=100 cases a UUID-based SDK can also run.
		const applicable = vectors.filter((v) => v.swift_applicable !== false);
		expect(applicable.length).toBeGreaterThanOrEqual(100);
		// Swift-applicable identifiers must be canonical uppercase UUIDs (the SDK
		// re-derives `salt:UUID.uuidString`, which is uppercase).
		const uuidRe =
			/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
		for (const v of applicable) {
			expect(v.identifier).toMatch(uuidRe);
		}
	});

	it('signature set has valid, tampered, wrong-kid, and wrong-key cases', () => {
		const kinds = read('signature.json').cases.map(
			(c: { kind: string }) => c.kind,
		);
		expect(kinds).toEqual(
			expect.arrayContaining(['valid', 'tampered', 'wrong_kid', 'wrong_key']),
		);
	});
});
