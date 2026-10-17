import {
	buildTestUpdatePayload,
	buildTestVariants,
	type StoredTestVariants,
} from '@/lib/test-group-variants';

// The test edit page builds its PUT body here. Group values are authored per
// flag from the Flags page, so the edit form must carry them through.

const stored = (): StoredTestVariants => ({
	control: {
		percentage: 50,
		values: {
			development: { flag_a: 'grey' },
			beta: { flag_a: 'grey' },
			production: { flag_a: 'grey', flag_b: false },
		},
	},
	treatment: {
		percentage: 50,
		values: {
			development: { flag_a: 'green' },
			beta: { flag_a: 'green' },
			production: { flag_a: 'green', flag_b: true },
		},
	},
});

const form = (
	groups: Array<{ name: string; weight: number; storedName?: string }>,
) => ({
	name: 'Button test',
	description: 'Green converts better',
	group: 'Growth',
	conditions: [],
	groups,
});

describe('buildTestVariants', () => {
	test('kept groups keep their values; only the percentage changes', () => {
		const before = stored();
		const variants = buildTestVariants(before, [
			{ name: 'control', weight: 20, storedName: 'control' },
			{ name: 'treatment', weight: 80, storedName: 'treatment' },
		]);
		expect(variants).toEqual({
			control: { percentage: 20, values: before.control.values },
			treatment: { percentage: 80, values: before.treatment.values },
		});
	});

	test('an added group gets no values key at all, never an empty-string placeholder', () => {
		const variants = buildTestVariants(stored(), [
			{ name: 'control', weight: 34, storedName: 'control' },
			{ name: 'treatment', weight: 33, storedName: 'treatment' },
			{ name: 'Group 3', weight: 33 },
		]);
		expect(variants['Group 3']).toEqual({ percentage: 33 });
		expect(variants['Group 3']).not.toHaveProperty('values');
		expect(JSON.stringify(variants)).not.toContain('""');
	});

	test('a removed group is dropped with its values', () => {
		const variants = buildTestVariants(stored(), [
			{ name: 'treatment', weight: 50, storedName: 'treatment' },
			{ name: 'blue', weight: 50 },
		]);
		expect(Object.keys(variants)).toEqual(['treatment', 'blue']);
	});

	test('a renamed group carries its values to the new name', () => {
		const before = stored();
		const variants = buildTestVariants(before, [
			{ name: 'baseline', weight: 50, storedName: 'control' },
			{ name: 'treatment', weight: 50, storedName: 'treatment' },
		]);
		expect(variants.baseline.values).toBe(before.control.values);
		expect(variants).not.toHaveProperty('control');
	});

	test('swapping two names swaps nothing: values follow the group, not the name', () => {
		const before = stored();
		const variants = buildTestVariants(before, [
			{ name: 'treatment', weight: 50, storedName: 'control' },
			{ name: 'control', weight: 50, storedName: 'treatment' },
		]);
		expect(variants.treatment.values).toBe(before.control.values);
		expect(variants.control.values).toBe(before.treatment.values);
	});

	test('a new group reusing a removed group name does not inherit its values', () => {
		const variants = buildTestVariants(stored(), [
			{ name: 'treatment', weight: 50, storedName: 'treatment' },
			{ name: 'control', weight: 50 },
		]);
		expect(variants.control).toEqual({ percentage: 50 });
	});

	test('other stored group fields are kept', () => {
		const before = {
			control: { percentage: 50, note: 'legacy' },
		} as unknown as StoredTestVariants;
		const variants = buildTestVariants(before, [
			{ name: 'control', weight: 100, storedName: 'control' },
		]);
		expect(variants.control).toEqual({ percentage: 100, note: 'legacy' });
	});

	test('a test with no stored groups yet gives every group no values', () => {
		expect(
			buildTestVariants(null, [
				{ name: 'Treatment', weight: 50 },
				{ name: 'Control', weight: 50 },
			]),
		).toEqual({
			Treatment: { percentage: 50 },
			Control: { percentage: 50 },
		});
	});

	test('duplicate group names throw instead of silently merging groups', () => {
		expect(() =>
			buildTestVariants(stored(), [
				{ name: 'control', weight: 50, storedName: 'control' },
				{ name: 'control', weight: 50, storedName: 'treatment' },
			]),
		).toThrow(/unique/);
	});
});

describe('buildTestUpdatePayload', () => {
	test('sends only what the form edits: never flagIds or archived', () => {
		const payload = buildTestUpdatePayload(
			stored(),
			form([
				{ name: 'control', weight: 30, storedName: 'control' },
				{ name: 'treatment', weight: 70, storedName: 'treatment' },
			]),
		);
		expect(Object.keys(payload).sort()).toEqual([
			'conditions',
			'description',
			'group',
			'name',
			'variants',
		]);
	});

	test('omits variants when no group changed', () => {
		const payload = buildTestUpdatePayload(
			stored(),
			form([
				{ name: 'control', weight: 50, storedName: 'control' },
				{ name: 'treatment', weight: 50, storedName: 'treatment' },
			]),
		);
		expect(payload).not.toHaveProperty('variants');
		expect(payload.name).toBe('Button test');
	});

	test('sends variants when a group is replaced by a new one with the same name and split', () => {
		// The values must not survive, so this is a change even though the
		// names and percentages match.
		const payload = buildTestUpdatePayload(
			stored(),
			form([
				{ name: 'control', weight: 50 },
				{ name: 'treatment', weight: 50, storedName: 'treatment' },
			]),
		);
		expect(payload.variants?.control).toEqual({ percentage: 50 });
	});

	test('an empty admin group label is sent as null', () => {
		const payload = buildTestUpdatePayload(stored(), {
			...form([
				{ name: 'control', weight: 50, storedName: 'control' },
				{ name: 'treatment', weight: 50, storedName: 'treatment' },
			]),
			group: '',
		});
		expect(payload.group).toBeNull();
	});
});
