import {
	DEVICE_CLASS_OPTIONS,
	expandPlatformGroups,
	isReservedCustomAttribute,
	PLATFORM_GROUP_EXPANSIONS,
	PLATFORM_OPTIONS,
	RESERVED_CUSTOM_ATTRIBUTES,
	splitCustomAttributeValues,
} from '@/types/core';

describe('PLATFORM_OPTIONS', () => {
	it('is exactly the seven lowercase SDK platform values, with no iPadOS', () => {
		const values = PLATFORM_OPTIONS.map((o) => o.value).sort();
		expect(values).toEqual(
			['ios', 'android', 'macos', 'watchos', 'tvos', 'visionos', 'web'].sort(),
		);
		expect(values).not.toContain('iPadOS');
		expect(values).not.toContain('iOS');
	});
});

describe('DEVICE_CLASS_OPTIONS', () => {
	it('covers the six form factors', () => {
		const values = DEVICE_CLASS_OPTIONS.map((o) => o.value).sort();
		expect(values).toEqual(
			['phone', 'tablet', 'desktop', 'tv', 'watch', 'headset'].sort(),
		);
	});
});

describe('expandPlatformGroups', () => {
	it('expands all_apple to the five Apple platforms only', () => {
		expect(expandPlatformGroups(['all_apple']).sort()).toEqual(
			['ios', 'macos', 'watchos', 'tvos', 'visionos'].sort(),
		);
		expect(expandPlatformGroups(['all_apple'])).not.toContain('android');
		expect(expandPlatformGroups(['all_apple'])).not.toContain('web');
	});

	it('expands everything to all seven platforms', () => {
		expect(expandPlatformGroups(['everything']).sort()).toEqual(
			['ios', 'android', 'macos', 'watchos', 'tvos', 'visionos', 'web'].sort(),
		);
	});

	it('passes concrete values through and de-dupes', () => {
		expect(expandPlatformGroups(['ios', 'all_apple'])).toEqual([
			'ios',
			'macos',
			'watchos',
			'tvos',
			'visionos',
		]);
	});
});

describe('PLATFORM_GROUP_EXPANSIONS', () => {
	it('exposes only the everything and all_apple tokens', () => {
		expect(Object.keys(PLATFORM_GROUP_EXPANSIONS).sort()).toEqual([
			'all_apple',
			'everything',
		]);
	});
});

describe('isReservedCustomAttribute', () => {
	it('is true for every name in RESERVED_CUSTOM_ATTRIBUTES', () => {
		for (const name of RESERVED_CUSTOM_ATTRIBUTES) {
			expect(isReservedCustomAttribute(name)).toBe(true);
		}
	});

	it('is false for an app-defined name', () => {
		expect(isReservedCustomAttribute('subscription_plan')).toBe(false);
	});

	it('is case-sensitive (matches the SDK-side lookup key exactly)', () => {
		expect(isReservedCustomAttribute('Manufacturer')).toBe(false);
	});
});

describe('splitCustomAttributeValues', () => {
	it('splits attribute name and accepted values', () => {
		expect(
			splitCustomAttributeValues(['manufacturer', 'apple', 'samsung']),
		).toEqual({
			attributeName: 'manufacturer',
			acceptedValues: ['apple', 'samsung'],
		});
	});

	it('handles a name-only array (no accepted values yet)', () => {
		expect(splitCustomAttributeValues(['manufacturer'])).toEqual({
			attributeName: 'manufacturer',
			acceptedValues: [],
		});
	});

	it('handles an empty array', () => {
		expect(splitCustomAttributeValues([])).toEqual({
			attributeName: '',
			acceptedValues: [],
		});
	});
});
