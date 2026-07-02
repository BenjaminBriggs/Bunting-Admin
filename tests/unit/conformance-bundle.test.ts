import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const dir = join(process.cwd(), 'conformance');
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

describe('conformance bundle', () => {
	it('has a manifest listing the five sets', () => {
		expect(existsSync(join(dir, 'manifest.json'))).toBe(true);
		const manifest = read('manifest.json');
		expect(Object.keys(manifest.sets).sort()).toEqual([
			'bootstrap',
			'bucketing',
			'evaluation',
			'fingerprint',
			'signature',
		]);
		expect(typeof manifest.version).toBe('string');
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
