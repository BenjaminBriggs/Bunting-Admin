import { PLATFORM_OPTIONS } from '@/types/core';

describe('PLATFORM_OPTIONS', () => {
	it('covers exactly the six SDK platform values, iPadOS distinct from iOS', () => {
		const values = PLATFORM_OPTIONS.map((o) => o.value).sort();
		expect(values).toEqual(
			['iOS', 'iPadOS', 'macOS', 'watchOS', 'tvOS', 'visionOS'].sort(),
		);
	});

	it('includes iPadOS as its own option (not merged into iOS)', () => {
		expect(PLATFORM_OPTIONS.some((o) => o.value === 'iPadOS')).toBe(true);
		expect(PLATFORM_OPTIONS.some((o) => o.value === 'iOS')).toBe(true);
	});
});
