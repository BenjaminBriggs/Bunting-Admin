import { expandPlatformGroups } from '@/types/core';

// The generator wires expandPlatformGroups into normalizeCondition; this test
// pins the exact publish-time expansion contract that the wiring must satisfy.
describe('platform group expansion at publish', () => {
	it('all_apple expands to the five Apple platforms', () => {
		expect(expandPlatformGroups(['all_apple'])).toEqual([
			'ios',
			'macos',
			'watchos',
			'tvos',
			'visionos',
		]);
	});

	it('everything expands to all seven platforms', () => {
		expect(expandPlatformGroups(['everything'])).toEqual([
			'ios',
			'android',
			'macos',
			'watchos',
			'tvos',
			'visionos',
			'web',
		]);
	});

	it('mixes a concrete value with a group and de-dupes', () => {
		expect(expandPlatformGroups(['ios', 'all_apple'])).toEqual([
			'ios',
			'macos',
			'watchos',
			'tvos',
			'visionos',
		]);
	});

	it('leaves a group-free list unchanged', () => {
		expect(expandPlatformGroups(['ios', 'web'])).toEqual(['ios', 'web']);
	});
});
