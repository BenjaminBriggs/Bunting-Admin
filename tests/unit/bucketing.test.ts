import { assignVariant, bucketFor, isInRollout } from '@/lib/bucketing';

describe('bucketFor', () => {
	it('is deterministic for the same salt + id', () => {
		const a = bucketFor('salt-1', 'user-abc');
		const b = bucketFor('salt-1', 'user-abc');
		expect(a).toBe(b);
	});

	it('always lands in 1..100', () => {
		for (let i = 0; i < 500; i++) {
			const bucket = bucketFor('s', `user-${i}`);
			expect(bucket).toBeGreaterThanOrEqual(1);
			expect(bucket).toBeLessThanOrEqual(100);
		}
	});

	it('matches pinned regression vectors (algorithm must not drift from the SDK)', () => {
		// Authoritative parity vectors: the admin and SDK both take the first 8
		// bytes of SHA-256(`salt:id`) as a big-endian uint64, so for an identical
		// input string they MUST produce the same bucket. See ../docs/concepts.md
		// §Deterministic Bucketing and bunting-sdk-swift Bucketing.swift.
		expect(bucketFor('test-salt', 'user-123')).toBe(27);
		expect(bucketFor('test-salt', 'user-456')).toBe(35);
	});

	it('different salts generally produce different buckets for the same id', () => {
		const buckets = new Set<number>();
		for (let i = 0; i < 20; i++) {
			buckets.add(bucketFor(`salt-${i}`, 'same-user'));
		}
		expect(buckets.size).toBeGreaterThan(1);
	});
});

describe('isInRollout', () => {
	it('0% excludes everyone, 100% includes everyone', () => {
		expect(isInRollout('s', 'u', 0)).toBe(false);
		expect(isInRollout('s', 'u', 100)).toBe(true);
	});

	it('agrees with bucketFor (in iff bucket <= percentage)', () => {
		const bucket = bucketFor('roll', 'user-xyz'); // 1..100
		expect(isInRollout('roll', 'user-xyz', bucket)).toBe(true);
		expect(isInRollout('roll', 'user-xyz', bucket - 1)).toBe(false);
	});

	it('is monotonic: increasing percentage never drops a user', () => {
		const id = 'monotonic-user';
		let wasIn = false;
		for (let p = 0; p <= 100; p++) {
			const inNow = isInRollout('s', id, p);
			if (wasIn) {
				expect(inNow).toBe(true);
			}
			wasIn = inNow;
		}
	});
});

describe('assignVariant', () => {
	it('assigns by cumulative percentage', () => {
		const variants = [
			{ name: 'a', percentage: 50 },
			{ name: 'b', percentage: 50 },
		];
		const bucket = bucketFor('exp', 'user-1');
		const expected = bucket <= 50 ? 'a' : 'b';
		expect(assignVariant('exp', 'user-1', variants)).toBe(expected);
	});

	it('returns null when the variant percentages do not cover the bucket', () => {
		// 'test-salt'/'user-123' => bucket 27, so a 20% single variant excludes it.
		expect(
			assignVariant('test-salt', 'user-123', [
				{ name: 'a', percentage: 20 },
			]),
		).toBeNull();
	});

	it('every user lands in some variant when percentages sum to 100', () => {
		const variants = [
			{ name: 'a', percentage: 34 },
			{ name: 'b', percentage: 33 },
			{ name: 'c', percentage: 33 },
		];
		for (let i = 0; i < 200; i++) {
			const v = assignVariant('full', `user-${i}`, variants);
			expect(['a', 'b', 'c']).toContain(v);
		}
	});
});
