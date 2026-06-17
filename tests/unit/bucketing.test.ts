import { bucketFor, isInRollout, assignVariant } from '@/lib/bucketing';

describe('bucketFor', () => {
	it('is deterministic for the same salt + id', async () => {
		const a = await bucketFor('salt-1', 'user-abc');
		const b = await bucketFor('salt-1', 'user-abc');
		expect(a).toBe(b);
	});

	it('always lands in 1..100', async () => {
		for (let i = 0; i < 500; i++) {
			const bucket = await bucketFor('s', `user-${i}`);
			expect(bucket).toBeGreaterThanOrEqual(1);
			expect(bucket).toBeLessThanOrEqual(100);
		}
	});

	it('matches pinned regression vectors (algorithm must not drift from the SDK)', async () => {
		expect(await bucketFor('test-salt', 'user-123')).toBe(82);
		expect(await bucketFor('test-salt', 'user-456')).toBe(53);
	});

	it('different salts generally produce different buckets for the same id', async () => {
		const buckets = new Set<number>();
		for (let i = 0; i < 20; i++)
			buckets.add(await bucketFor(`salt-${i}`, 'same-user'));
		expect(buckets.size).toBeGreaterThan(1);
	});
});

describe('isInRollout', () => {
	it('0% excludes everyone, 100% includes everyone', async () => {
		expect(await isInRollout('s', 'u', 0)).toBe(false);
		expect(await isInRollout('s', 'u', 100)).toBe(true);
	});

	it('agrees with bucketFor (in iff bucket <= percentage)', async () => {
		const bucket = await bucketFor('roll', 'user-xyz'); // 1..100
		expect(await isInRollout('roll', 'user-xyz', bucket)).toBe(true);
		expect(await isInRollout('roll', 'user-xyz', bucket - 1)).toBe(false);
	});

	it('is monotonic: increasing percentage never drops a user', async () => {
		const id = 'monotonic-user';
		let wasIn = false;
		for (let p = 0; p <= 100; p++) {
			const inNow = await isInRollout('s', id, p);
			if (wasIn) expect(inNow).toBe(true);
			wasIn = inNow;
		}
	});
});

describe('assignVariant', () => {
	it('assigns by cumulative percentage', async () => {
		const variants = [
			{ name: 'a', percentage: 50 },
			{ name: 'b', percentage: 50 },
		];
		const bucket = await bucketFor('exp', 'user-1');
		const expected = bucket <= 50 ? 'a' : 'b';
		expect(await assignVariant('exp', 'user-1', variants)).toBe(expected);
	});

	it('returns null when the variant percentages do not cover the bucket', async () => {
		// 'test-salt'/'user-123' => bucket 82, so a 30% single variant excludes it.
		expect(
			await assignVariant('test-salt', 'user-123', [
				{ name: 'a', percentage: 30 },
			]),
		).toBeNull();
	});

	it('every user lands in some variant when percentages sum to 100', async () => {
		const variants = [
			{ name: 'a', percentage: 34 },
			{ name: 'b', percentage: 33 },
			{ name: 'c', percentage: 33 },
		];
		for (let i = 0; i < 200; i++) {
			const v = await assignVariant('full', `user-${i}`, variants);
			expect(['a', 'b', 'c']).toContain(v);
		}
	});
});
