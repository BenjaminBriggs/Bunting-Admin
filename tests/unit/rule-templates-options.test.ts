import {
	conditionTemplates,
	visibleConditionOptions,
} from '@/components/features/rules/rule-templates';

describe('conditionTemplates', () => {
	it('exposes a device_class template with the six form factors', () => {
		const t = conditionTemplates.find((x) => x.type === 'device_class');
		expect(t).toBeDefined();
		expect(t?.options?.map((o) => o.value).sort()).toEqual(
			['phone', 'tablet', 'desktop', 'tv', 'watch', 'headset'].sort(),
		);
	});

	it('offers platform group tokens and lowercase platform values, no iPadOS', () => {
		const platform = conditionTemplates.find((x) => x.type === 'platform');
		const values = platform?.options?.map((o) => o.value) ?? [];
		expect(values).toEqual(
			expect.arrayContaining(['everything', 'all_apple', 'ios', 'web']),
		);
		expect(values).not.toContain('iPadOS');
	});
});

describe('visibleConditionOptions', () => {
	const platformTemplate = conditionTemplates.find(
		(t) => t.type === 'platform',
	)!;
	const deviceClassTemplate = conditionTemplates.find(
		(t) => t.type === 'device_class',
	)!;

	it('hides platform group tokens for not_in', () => {
		const values = visibleConditionOptions(platformTemplate, 'not_in')?.map(
			(o) => o.value,
		);
		expect(values).not.toContain('everything');
		expect(values).not.toContain('all_apple');
		expect(values).toEqual(expect.arrayContaining(['ios', 'web']));
	});

	it('keeps platform group tokens for in', () => {
		const values = visibleConditionOptions(platformTemplate, 'in')?.map(
			(o) => o.value,
		);
		expect(values).toEqual(expect.arrayContaining(['everything', 'all_apple']));
	});

	it('leaves non-platform templates unaffected regardless of operator', () => {
		expect(visibleConditionOptions(deviceClassTemplate, 'not_in')).toEqual(
			deviceClassTemplate.options,
		);
	});
});
