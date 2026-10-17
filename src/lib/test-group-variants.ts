/**
 * Builds a test's stored `variants` blob from the groups the test edit form
 * submits.
 *
 * Stored shape: `{ [groupName]: { percentage, values? } }`, where `values` is
 * `{ development?, beta?, production? }` and each environment normally holds a
 * per-flag map `{ [flagId]: value }` (see `resolveFlagSpecificValue` in
 * config-generator.ts). The edit form only edits group names and weights; the
 * per-flag values are authored from the Flags page, so this carries them
 * through untouched:
 *
 * - a group the form kept keeps its stored `values`. It is matched by the name
 *   it was loaded under (`storedName`), so renaming a group keeps its values;
 * - a group added in the form gets no `values` at all. A group with no value
 *   for a flag is not in the test for that flag (contract rule C3): its users
 *   fall through to the next variant or the default;
 * - a group removed in the form is dropped, values included.
 */
import type { Condition, TestVariant } from '@/types';

export interface EditedTestGroup {
	name: string;
	weight: number;
	/** The stored group this row was loaded from; absent for groups added in the form. */
	storedName?: string;
}

export type StoredTestVariants = Record<string, TestVariant>;

export function buildTestVariants(
	stored: StoredTestVariants | null | undefined,
	groups: EditedTestGroup[],
): StoredTestVariants {
	const variants: StoredTestVariants = {};
	for (const group of groups) {
		if (Object.hasOwn(variants, group.name)) {
			// Two rows with one name would collapse into one group and lose the
			// other's values.
			throw new Error(
				`Group names must be unique: "${group.name}" is used twice.`,
			);
		}
		const kept =
			group.storedName !== undefined &&
			stored &&
			Object.hasOwn(stored, group.storedName)
				? stored[group.storedName]
				: undefined;
		// Spread the stored group so its values (and anything else stored on it)
		// carry over; only the percentage comes from the form.
		variants[group.name] = kept
			? { ...kept, percentage: group.weight }
			: { percentage: group.weight };
	}
	return variants;
}

/**
 * True when building from the form changed nothing: same groups, order,
 * percentages and carried values. A form that changed no group then sends no
 * `variants`, so it cannot overwrite values set elsewhere since the page loaded.
 */
export function unchangedTestVariants(
	stored: StoredTestVariants | null | undefined,
	next: StoredTestVariants,
): boolean {
	return JSON.stringify(stored ?? {}) === JSON.stringify(next);
}

export interface TestEditSubmit {
	name: string;
	description: string;
	group: string;
	conditions: Condition[];
	groups: EditedTestGroup[];
}

export interface TestUpdatePayload {
	name: string;
	description: string;
	group: string | null;
	conditions: Condition[];
	variants?: StoredTestVariants;
}

/**
 * The PUT /api/test-rollouts/[id] body for a test edit. It carries only what
 * the form edits: never `flagIds` or `archived` (the route leaves absent fields
 * unchanged), and `variants` only when the groups changed.
 */
export function buildTestUpdatePayload(
	stored: StoredTestVariants | null | undefined,
	form: TestEditSubmit,
): TestUpdatePayload {
	const payload: TestUpdatePayload = {
		name: form.name,
		description: form.description,
		group: form.group || null,
		conditions: form.conditions,
	};
	const variants = buildTestVariants(stored, form.groups);
	if (!unchangedTestVariants(stored, variants)) {
		payload.variants = variants;
	}
	return payload;
}
