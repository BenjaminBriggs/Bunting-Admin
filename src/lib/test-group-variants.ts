/**
 * Test groups: their order, and the stored `variants` blob the test edit form
 * produces.
 *
 * Stored shape: `{ [groupName]: { percentage, position?, values? } }`, where
 * `values` is `{ development?, beta?, production? }` and each environment
 * normally holds a per-flag map `{ [flagId]: value }` (see
 * `resolveFlagSpecificValue` in config-generator.ts).
 *
 * Group order is part of what users get: SDKs bucket a user into a group by
 * cumulative percentage in the order of the artifact's `groups`, so reordering
 * groups moves users between them. That order comes from each group's integer
 * `position`, never from its name or from JSON key order (Postgres jsonb sorts
 * object keys shorter-first, so renaming a group would otherwise reorder them).
 */
import type { Condition, TestVariant } from '@/types';

export interface EditedTestGroup {
	name: string;
	weight: number;
	/** The stored group this row was loaded from; absent for groups added in the form. */
	storedName?: string;
}

export type StoredTestVariants = Record<string, TestVariant>;

function allPositioned(entries: Array<[string, { position?: number }]>) {
	return entries.every(([, group]) => Number.isInteger(group.position));
}

/**
 * A test's groups in bucketing order: by `position`.
 *
 * Legacy rows, written before groups had a position (or any row where a group
 * lacks one), keep the order the config generator has always used:
 * Object.entries order of the JSON Prisma returns, i.e. jsonb key order. Their
 * published artifacts already reflect that order, so upgrading moves no users
 * between groups, and the first edit of such a test writes that order down as
 * positions (see buildTestVariants).
 */
export function orderedTestGroups<G extends { position?: number }>(
	variants: Record<string, G> | null | undefined,
): Array<[string, G]> {
	const entries = Object.entries(variants ?? {});
	if (!allPositioned(entries)) {
		return entries;
	}
	// Array.prototype.sort is stable: equal positions keep entries order.
	return [...entries].sort(
		([, a], [, b]) => (a.position ?? 0) - (b.position ?? 0),
	);
}

/**
 * `variants` with every group given a position in its current order (see
 * orderedTestGroups). Used when a test is created.
 */
export function withGroupPositions(
	variants: StoredTestVariants,
): StoredTestVariants {
	return Object.fromEntries(
		orderedTestGroups(variants).map(([name, group], position) => [
			name,
			{ ...group, position },
		]),
	);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// The stored groups with positions: as stored when every group has one, else
// numbered in their current emitted order (withGroupPositions). That is how a
// legacy row's first write records the order its users are bucketed in today.
function positionedStored(
	stored: StoredTestVariants | null | undefined,
): StoredTestVariants {
	const variants = stored ?? {};
	return allPositioned(Object.entries(variants))
		? variants
		: withGroupPositions(variants);
}

/**
 * The stored `variants` for the groups the edit form submits. The form only
 * edits group names and weights; per-flag values are authored from the Flags
 * page, so they are carried through untouched:
 *
 * - a group the form kept keeps its stored values and its position. It is
 *   matched by the name it was loaded under (`storedName`), so a renamed group
 *   keeps both, and no user moves to another group;
 * - a group added in the form gets the next positions after the kept groups,
 *   and no `values` at all. A group with no value for a flag is not in the test
 *   for that flag (contract rule C3): its users fall through to the next
 *   variant or the default;
 * - a group removed in the form is dropped, values included.
 *
 * A legacy row's groups take their positions from the order they are bucketed
 * in today (orderedTestGroups), so its first save changes no one's group.
 */
export function buildTestVariants(
	stored: StoredTestVariants | null | undefined,
	groups: EditedTestGroup[],
): StoredTestVariants {
	const base = positionedStored(stored);
	const keptOf = (g: EditedTestGroup) =>
		g.storedName !== undefined && Object.hasOwn(base, g.storedName)
			? base[g.storedName]
			: undefined;

	let nextPosition =
		Math.max(-1, ...groups.map((g) => keptOf(g)?.position ?? -1)) + 1;
	const variants: StoredTestVariants = {};
	for (const group of groups) {
		if (Object.hasOwn(variants, group.name)) {
			// Two rows with one name would collapse into one group and lose the
			// other's values.
			throw new Error(
				`Group names must be unique: "${group.name}" is used twice.`,
			);
		}
		const kept = keptOf(group);
		// Spread the stored group so its values, position (and anything else
		// stored on it) carry over; only the percentage comes from the form.
		variants[group.name] = kept
			? { ...kept, percentage: group.weight }
			: { percentage: group.weight, position: nextPosition++ };
	}
	return variants;
}

/**
 * Positions are server-owned: update routes that write a test's `variants`
 * pass the body through this, so a client that omits positions cannot reorder
 * groups and move users. An incoming group without a whole-number `position`
 * keeps the position of the stored group with the same name, or is appended
 * after the highest position. Positions a client sends are used as given.
 * A legacy stored row is first numbered in its current emitted order, as
 * buildTestVariants does on first save. Anything that is not a map of group
 * objects (null to clear, a malformed body) is returned unchanged.
 */
export function assignGroupPositions<T>(
	stored: StoredTestVariants | null | undefined,
	incoming: T,
): T {
	if (!isObject(incoming)) {
		return incoming;
	}
	const base = positionedStored(stored);
	const sent = (group: unknown): number | undefined =>
		isObject(group) && Number.isInteger(group.position)
			? (group.position as number)
			: undefined;

	let nextPosition =
		Math.max(
			-1,
			...Object.values(base).map((g) => g.position ?? -1),
			...Object.values(incoming).map((g) => sent(g) ?? -1),
		) + 1;
	return Object.fromEntries(
		Object.entries(incoming).map(([name, group]) => {
			if (!isObject(group) || sent(group) !== undefined) {
				return [name, group];
			}
			const position = Object.hasOwn(base, name)
				? (base[name].position ?? nextPosition++)
				: nextPosition++;
			return [name, { ...group, position }];
		}),
	) as T;
}

/**
 * True when building from the form changed nothing: the same groups with the
 * same percentages, positions and carried values (JSON key order aside, since
 * jsonb does not keep it). A form that changed no group then sends no
 * `variants`, so it cannot overwrite values set elsewhere since the page loaded.
 */
export function unchangedTestVariants(
	stored: StoredTestVariants | null | undefined,
	next: StoredTestVariants,
): boolean {
	const before = stored ?? {};
	const names = Object.keys(next);
	return (
		names.length === Object.keys(before).length &&
		names.every(
			(name) =>
				Object.hasOwn(before, name) &&
				JSON.stringify(before[name]) === JSON.stringify(next[name]),
		)
	);
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
