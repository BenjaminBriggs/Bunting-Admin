import {
	assignGroupPositions,
	buildTestUpdatePayload,
	buildTestVariants,
	orderedTestGroups,
	type StoredTestVariants,
	withGroupPositions,
} from '@/lib/test-group-variants';

// The test edit page builds its PUT body here. Group values are authored per
// flag from the Flags page, so the edit form must carry them through, and a
// group's position (its bucketing order) must never change on an edit.

const valuesOf = (color: string, on: boolean) => ({
	development: { flag_a: color },
	beta: { flag_a: color },
	production: { flag_a: color, flag_b: on },
});

// A test stored with positions, in an order that differs from key order.
const stored = (): StoredTestVariants => ({
	treatment: { percentage: 50, position: 0, values: valuesOf('green', true) },
	control: { percentage: 50, position: 1, values: valuesOf('grey', false) },
});

// The same test stored before positions existed: its bucketing order is the
// key order Prisma returns.
const legacy = (): StoredTestVariants => ({
	control: { percentage: 50, values: valuesOf('grey', false) },
	treatment: { percentage: 50, values: valuesOf('green', true) },
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

const names = (variants: StoredTestVariants) =>
	orderedTestGroups(variants).map(([name]) => name);

describe('orderedTestGroups', () => {
	test('orders by position, not by key order', () => {
		expect(names(stored())).toEqual(['treatment', 'control']);
	});

	test('a legacy row without positions keeps key order', () => {
		expect(names(legacy())).toEqual(['control', 'treatment']);
	});

	test('a row where any group lacks a position is treated as legacy', () => {
		expect(
			names({
				b: { percentage: 50, position: 1 },
				a: { percentage: 50 },
			}),
		).toEqual(['b', 'a']);
	});

	test('handles a missing variants blob', () => {
		expect(orderedTestGroups(null)).toEqual([]);
	});
});

describe('withGroupPositions', () => {
	test('numbers groups in key order when none has a position', () => {
		expect(
			withGroupPositions({
				zeta: { percentage: 50 },
				alpha_group: { percentage: 50 },
			}),
		).toEqual({
			zeta: { percentage: 50, position: 0 },
			alpha_group: { percentage: 50, position: 1 },
		});
	});
});

describe('buildTestVariants', () => {
	test('kept groups keep their values and positions; only the percentage changes', () => {
		const before = stored();
		const variants = buildTestVariants(before, [
			{ name: 'treatment', weight: 80, storedName: 'treatment' },
			{ name: 'control', weight: 20, storedName: 'control' },
		]);
		expect(variants).toEqual({
			treatment: { ...before.treatment, percentage: 80 },
			control: { ...before.control, percentage: 20 },
		});
	});

	test('an added group is appended after the kept groups, with no values key at all', () => {
		const variants = buildTestVariants(stored(), [
			{ name: 'treatment', weight: 34, storedName: 'treatment' },
			{ name: 'control', weight: 33, storedName: 'control' },
			{ name: 'Group 3', weight: 33 },
		]);
		expect(variants['Group 3']).toEqual({ percentage: 33, position: 2 });
		expect(variants['Group 3']).not.toHaveProperty('values');
		expect(JSON.stringify(variants)).not.toContain('""');
		expect(names(variants)).toEqual(['treatment', 'control', 'Group 3']);
	});

	test('a removed group is dropped with its values; the others keep their positions', () => {
		const variants = buildTestVariants(stored(), [
			{ name: 'control', weight: 50, storedName: 'control' },
			{ name: 'blue', weight: 50 },
		]);
		expect(variants).toEqual({
			control: { ...stored().control, percentage: 50 },
			blue: { percentage: 50, position: 2 },
		});
	});

	test('a renamed group carries its values and position to the new name', () => {
		const before = stored();
		const variants = buildTestVariants(before, [
			{
				name: 'a_much_longer_treatment_name',
				weight: 50,
				storedName: 'treatment',
			},
			{ name: 'control', weight: 50, storedName: 'control' },
		]);
		expect(variants.a_much_longer_treatment_name).toEqual({
			...before.treatment,
			percentage: 50,
		});
		expect(variants).not.toHaveProperty('treatment');
		expect(names(variants)).toEqual([
			'a_much_longer_treatment_name',
			'control',
		]);
	});

	test('swapping two names swaps nothing: values and position follow the group, not the name', () => {
		const before = stored();
		const variants = buildTestVariants(before, [
			{ name: 'control', weight: 50, storedName: 'treatment' },
			{ name: 'treatment', weight: 50, storedName: 'control' },
		]);
		expect(variants.control.values).toBe(before.treatment.values);
		expect(variants.control.position).toBe(0);
		expect(variants.treatment.values).toBe(before.control.values);
		expect(variants.treatment.position).toBe(1);
	});

	test('a new group reusing a removed group name does not inherit its values or position', () => {
		const variants = buildTestVariants(stored(), [
			{ name: 'control', weight: 50, storedName: 'control' },
			{ name: 'treatment', weight: 50 },
		]);
		expect(variants.treatment).toEqual({ percentage: 50, position: 2 });
	});

	test('other stored group fields are kept', () => {
		const before = {
			control: { percentage: 50, position: 0, note: 'legacy' },
		} as unknown as StoredTestVariants;
		const variants = buildTestVariants(before, [
			{ name: 'control', weight: 100, storedName: 'control' },
		]);
		expect(variants.control).toEqual({
			percentage: 100,
			position: 0,
			note: 'legacy',
		});
	});

	test('a test with no stored groups yet gives every group a position and no values', () => {
		expect(
			buildTestVariants(null, [
				{ name: 'Treatment', weight: 50 },
				{ name: 'Control', weight: 50 },
			]),
		).toEqual({
			Treatment: { percentage: 50, position: 0 },
			Control: { percentage: 50, position: 1 },
		});
	});

	test('a legacy row gets positions in the order it is bucketed in today', () => {
		const before = legacy();
		const variants = buildTestVariants(before, [
			{ name: 'baseline_group', weight: 50, storedName: 'control' },
			{ name: 'treatment', weight: 50, storedName: 'treatment' },
		]);
		expect(variants).toEqual({
			baseline_group: { ...before.control, position: 0 },
			treatment: { ...before.treatment, position: 1 },
		});
		// Same order as before the rename, although jsonb would now sort
		// "treatment" (shorter) ahead of "baseline_group".
		expect(names(variants)).toEqual(['baseline_group', 'treatment']);
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
				{ name: 'treatment', weight: 70, storedName: 'treatment' },
				{ name: 'control', weight: 30, storedName: 'control' },
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

	test('omits variants when no group changed, whatever the key order', () => {
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

	test('sends variants for an unchanged legacy row, to record its positions', () => {
		const payload = buildTestUpdatePayload(
			legacy(),
			form([
				{ name: 'control', weight: 50, storedName: 'control' },
				{ name: 'treatment', weight: 50, storedName: 'treatment' },
			]),
		);
		expect(names(payload.variants ?? {})).toEqual(['control', 'treatment']);
	});

	test('sends variants when a group is replaced by a new one with the same name and split', () => {
		// The values must not survive, so this is a change even though the
		// names and percentages match.
		const payload = buildTestUpdatePayload(
			stored(),
			form([
				{ name: 'treatment', weight: 50, storedName: 'treatment' },
				{ name: 'control', weight: 50 },
			]),
		);
		expect(payload.variants?.control).toEqual({ percentage: 50, position: 1 });
	});

	test('an empty admin group label is sent as null', () => {
		const payload = buildTestUpdatePayload(stored(), {
			...form([
				{ name: 'treatment', weight: 50, storedName: 'treatment' },
				{ name: 'control', weight: 50, storedName: 'control' },
			]),
			group: '',
		});
		expect(payload.group).toBeNull();
	});
});

describe('assignGroupPositions', () => {
	test('keeps stored positions by name, appends new groups, uses sent positions as given', () => {
		expect(
			assignGroupPositions(stored(), {
				new_one: { percentage: 10 },
				control: { percentage: 40 },
				treatment: { percentage: 50, position: 7 },
			}),
		).toEqual({
			new_one: { percentage: 10, position: 8 },
			control: { percentage: 40, position: 1 },
			treatment: { percentage: 50, position: 7 },
		});
	});

	test('numbers a legacy stored row in its current order first', () => {
		expect(
			assignGroupPositions(legacy(), {
				treatment: { percentage: 50 },
				control: { percentage: 50 },
			}),
		).toEqual({
			treatment: { percentage: 50, position: 1 },
			control: { percentage: 50, position: 0 },
		});
	});

	test('passes null (clear) and undefined (absent) through', () => {
		expect(assignGroupPositions(stored(), null)).toBeNull();
		expect(assignGroupPositions(stored(), undefined)).toBeUndefined();
	});
});
