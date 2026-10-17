/**
 * Reference decoder for the v1 config artifact wire contract.
 *
 * Every SDK decodes `config.json` by these rules, and the conformance bundle's
 * `decoding` set pins them:
 *
 * - C1 tolerance: one bad entry never rejects the whole artifact.
 *   - A flag with an unknown `type`, or one that can't be decoded (missing
 *     environment, default that doesn't match its type, `variants` that isn't
 *     an array), is skipped. Its accessor returns the call-site default.
 *   - A variant with an unknown `type`, or a malformed one (missing or
 *     mistyped value, missing test/rollout reference), is kept as an
 *     unrecognized placeholder: it never matches and counts as one
 *     fingerprint path. A variant without an integer `order` can't be placed
 *     and is dropped.
 *   - A condition with an unknown `type` or `operator`, or a malformed one,
 *     never matches (fail closed), so whatever it guards never matches.
 *   - A malformed test or rollout is dropped; variants referencing it never
 *     match.
 *   - Only the header is strict: invalid JSON, a `schema_version` other than
 *     1, or a malformed header or container rejects the artifact. Breaking
 *     changes bump `schema_version`.
 * - C2 typed values: values are decoded by the flag's declared `type`, never
 *   by their JSON shape (see `isValidWireValue`).
 *
 * Unknown keys are ignored everywhere, so additive fields stay compatible.
 *
 * The admin runs this at publish time to prove an artifact survives SDK
 * decoding intact, and the conformance generator uses it to compute the
 * expected outcome of decoding hand-built artifacts.
 */

import type {
	Condition,
	ConditionOperator,
	ConditionType,
	ConfigArtifact,
	Environment,
	EnvironmentFlag,
	EnvironmentFlagConfig,
	FlagType,
	FlagVariant,
	Rollout,
	Test,
	TestGroup,
} from '@/types';

export const SUPPORTED_SCHEMA_VERSION = 1;

/**
 * Marker for a variant or condition the decoder could not understand. It is
 * never emitted by the admin; it only appears in decoded artifacts, where the
 * evaluator and fingerprint treat it as never matching.
 */
export const UNRECOGNIZED = 'unrecognized';

const FLAG_TYPES: readonly FlagType[] = [
	'bool',
	'string',
	'int',
	'double',
	'date',
	'json',
];

const CONDITION_TYPES: readonly ConditionType[] = [
	'app_version',
	'os_version',
	'build_number',
	'platform',
	'device_class',
	'device_model',
	'region',
	'language',
	'custom_attribute',
];

const CONDITION_OPERATORS: readonly ConditionOperator[] = [
	'equals',
	'does_not_equals',
	'in',
	'not_in',
	'greater_than',
	'less_than',
	'greater_than_or_equal',
	'less_than_or_equal',
	'between',
	'custom',
];

const ENVIRONMENTS: readonly Environment[] = [
	'development',
	'beta',
	'production',
];

/** An ISO-8601 UTC instant, with or without fractional seconds. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export interface DecodeIssue {
	path: string;
	reason: string;
}

export interface DecodeResult {
	accepted: boolean;
	/** Why the artifact was rejected outright (only when `accepted` is false). */
	rejection?: string;
	/**
	 * The artifact as an SDK sees it: skipped flags and dropped tests/rollouts
	 * removed, unrecognized variants and conditions replaced by `UNRECOGNIZED`
	 * markers, dropped variants removed.
	 */
	artifact?: ConfigArtifact;
	skippedFlags: DecodeIssue[];
	unrecognizedVariants: DecodeIssue[];
	droppedVariants: DecodeIssue[];
	unrecognizedConditions: DecodeIssue[];
	droppedTests: DecodeIssue[];
	droppedRollouts: DecodeIssue[];
}

/** True when decoding lost nothing: what the admin published is what SDKs use. */
export function isLossless(result: DecodeResult): boolean {
	return (
		result.accepted &&
		result.skippedFlags.length === 0 &&
		result.unrecognizedVariants.length === 0 &&
		result.droppedVariants.length === 0 &&
		result.unrecognizedConditions.length === 0 &&
		result.droppedTests.length === 0 &&
		result.droppedRollouts.length === 0
	);
}

/** Every issue in a decode result, labelled by kind, for error reporting. */
export function decodeIssues(
	result: DecodeResult,
): Array<DecodeIssue & { kind: string }> {
	const label = (kind: string, issues: DecodeIssue[]) =>
		issues.map((issue) => ({ ...issue, kind }));
	return [
		...label('skipped_flag', result.skippedFlags),
		...label('unrecognized_variant', result.unrecognizedVariants),
		...label('dropped_variant', result.droppedVariants),
		...label('unrecognized_condition', result.unrecognizedConditions),
		...label('dropped_test', result.droppedTests),
		...label('dropped_rollout', result.droppedRollouts),
	];
}

/**
 * C2: whether a wire value is valid for a declared flag type.
 *
 * - bool: a JSON boolean
 * - int: a JSON number with no fractional part (`2.0` is the int 2)
 * - double: any finite JSON number
 * - string: any JSON string, taken verbatim
 * - date: a string holding an ISO-8601 UTC instant, with or without
 *   fractional seconds (`2026-07-02T00:00:00Z`, `2026-07-02T00:00:00.123Z`)
 * - json: a string holding JSON text, taken verbatim (never a raw object)
 */
export function isValidWireValue(type: FlagType, value: unknown): boolean {
	switch (type) {
		case 'bool':
			return typeof value === 'boolean';
		case 'int':
			return typeof value === 'number' && Number.isSafeInteger(value);
		case 'double':
			return typeof value === 'number' && Number.isFinite(value);
		case 'string':
		case 'json':
			return typeof value === 'string';
		case 'date':
			return (
				typeof value === 'string' &&
				ISO_INSTANT.test(value) &&
				!Number.isNaN(Date.parse(value))
			);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFlagType(value: unknown): value is FlagType {
	return FLAG_TYPES.includes(value as FlagType);
}

function unrecognizedCondition(): Condition {
	return {
		type: UNRECOGNIZED,
		operator: UNRECOGNIZED,
		values: [],
	} as unknown as Condition;
}

function unrecognizedVariant(order: number): FlagVariant {
	return { type: UNRECOGNIZED, order } as unknown as FlagVariant;
}

class Decoder {
	readonly skippedFlags: DecodeIssue[] = [];
	readonly unrecognizedVariants: DecodeIssue[] = [];
	readonly droppedVariants: DecodeIssue[] = [];
	readonly unrecognizedConditions: DecodeIssue[] = [];
	readonly droppedTests: DecodeIssue[] = [];
	readonly droppedRollouts: DecodeIssue[] = [];

	conditions(raw: unknown, path: string): Condition[] | undefined {
		if (raw === undefined || raw === null) {
			return [];
		}
		if (!Array.isArray(raw)) {
			return undefined;
		}
		return raw.map((entry, index) =>
			this.condition(entry, `${path}.conditions[${index}]`),
		);
	}

	condition(raw: unknown, path: string): Condition {
		const fail = (reason: string): Condition => {
			this.unrecognizedConditions.push({ path, reason });
			return unrecognizedCondition();
		};
		if (!isRecord(raw)) {
			return fail('not an object');
		}
		if (!CONDITION_TYPES.includes(raw.type as ConditionType)) {
			return fail(`unknown condition type "${String(raw.type)}"`);
		}
		if (!CONDITION_OPERATORS.includes(raw.operator as ConditionOperator)) {
			return fail(`unknown operator "${String(raw.operator)}"`);
		}
		const values = raw.values;
		if (
			!Array.isArray(values) ||
			!values.every((value) => typeof value === 'string')
		) {
			return fail('values must be an array of strings');
		}
		return {
			type: raw.type as ConditionType,
			operator: raw.operator as ConditionOperator,
			values: values,
		};
	}

	variant(raw: unknown, type: FlagType, path: string): FlagVariant | undefined {
		if (!isRecord(raw) || !Number.isSafeInteger(raw.order)) {
			this.droppedVariants.push({ path, reason: 'missing integer order' });
			return undefined;
		}
		const order = raw.order as number;
		const placeholder = (reason: string): FlagVariant => {
			this.unrecognizedVariants.push({ path, reason });
			return unrecognizedVariant(order);
		};

		switch (raw.type) {
			case 'conditional': {
				if (!isValidWireValue(type, raw.value)) {
					return placeholder(`value is not a valid ${type}`);
				}
				const conditions = this.conditions(raw.conditions, path);
				if (!conditions) {
					return placeholder('conditions must be an array');
				}
				return {
					type: 'conditional',
					order,
					value: raw.value as FlagVariant['value'],
					// Absent conditions match vacuously; keep them absent rather
					// than normalising to [] so the decoded shape mirrors the wire.
					...(raw.conditions === undefined || raw.conditions === null
						? {}
						: { conditions }),
				};
			}
			case 'test': {
				if (typeof raw.test !== 'string') {
					return placeholder('missing test reference');
				}
				if (!isRecord(raw.values)) {
					return placeholder('values must be an object');
				}
				const invalid = Object.entries(raw.values).find(
					([, value]) => !isValidWireValue(type, value),
				);
				if (invalid) {
					return placeholder(
						`group "${invalid[0]}" value is not a valid ${type}`,
					);
				}
				return {
					type: 'test',
					order,
					test: raw.test,
					values: raw.values as FlagVariant['values'],
				};
			}
			case 'rollout': {
				if (typeof raw.rollout !== 'string') {
					return placeholder('missing rollout reference');
				}
				if (!isValidWireValue(type, raw.value)) {
					return placeholder(`value is not a valid ${type}`);
				}
				return {
					type: 'rollout',
					order,
					rollout: raw.rollout,
					value: raw.value as FlagVariant['value'],
				};
			}
			default:
				return placeholder(`unknown variant type "${String(raw.type)}"`);
		}
	}

	environment(
		raw: unknown,
		type: FlagType,
		path: string,
	): EnvironmentFlagConfig | string {
		if (!isRecord(raw)) {
			return `${path} is missing or not an object`;
		}
		if (!isValidWireValue(type, raw.default)) {
			return `${path}.default is not a valid ${type}`;
		}
		if (
			raw.variants !== undefined &&
			raw.variants !== null &&
			!Array.isArray(raw.variants)
		) {
			return `${path}.variants must be an array`;
		}
		const variants: FlagVariant[] = [];
		((raw.variants as unknown[] | undefined) ?? []).forEach((entry, index) => {
			const variant = this.variant(entry, type, `${path}.variants[${index}]`);
			if (variant) {
				variants.push(variant);
			}
		});
		return {
			default: raw.default as EnvironmentFlagConfig['default'],
			variants,
		};
	}

	flag(key: string, raw: unknown): EnvironmentFlag | undefined {
		const path = `flags["${key}"]`;
		const skip = (reason: string): undefined => {
			this.skippedFlags.push({ path, reason });
			return undefined;
		};
		if (!isRecord(raw)) {
			return skip('not an object');
		}
		if (!isFlagType(raw.type)) {
			return skip(`unknown flag type "${String(raw.type)}"`);
		}
		const type = raw.type;

		// Decode every environment into a scratch decoder first, so a flag that
		// is skipped reports only the skip, not the issues inside it.
		const scratch = new Decoder();
		const environments: Partial<Record<Environment, EnvironmentFlagConfig>> =
			{};
		for (const env of ENVIRONMENTS) {
			const decoded = scratch.environment(raw[env], type, `${path}.${env}`);
			if (typeof decoded === 'string') {
				return skip(decoded);
			}
			environments[env] = decoded;
		}
		this.unrecognizedVariants.push(...scratch.unrecognizedVariants);
		this.droppedVariants.push(...scratch.droppedVariants);
		this.unrecognizedConditions.push(...scratch.unrecognizedConditions);

		return {
			type,
			...(typeof raw.description === 'string'
				? { description: raw.description }
				: {}),
			...(raw.deprecated === true ? { deprecated: true } : {}),
			development: environments.development as EnvironmentFlagConfig,
			beta: environments.beta as EnvironmentFlagConfig,
			production: environments.production as EnvironmentFlagConfig,
		};
	}

	test(name: string, raw: unknown): Test | undefined {
		const path = `tests["${name}"]`;
		const drop = (reason: string): undefined => {
			this.droppedTests.push({ path, reason });
			return undefined;
		};
		if (!isRecord(raw)) {
			return drop('not an object');
		}
		if (typeof raw.salt !== 'string') {
			return drop('missing salt');
		}
		const groups = decodeGroups(raw.groups);
		if (typeof groups === 'string') {
			return drop(groups);
		}
		const conditions = this.conditions(raw.conditions, path);
		if (!conditions) {
			return drop('conditions must be an array');
		}
		return {
			name: typeof raw.name === 'string' ? raw.name : name,
			type: 'test',
			salt: raw.salt,
			conditions,
			...(groups ? { groups } : {}),
		};
	}

	rollout(name: string, raw: unknown): Rollout | undefined {
		const path = `rollouts["${name}"]`;
		const drop = (reason: string): undefined => {
			this.droppedRollouts.push({ path, reason });
			return undefined;
		};
		if (!isRecord(raw)) {
			return drop('not an object');
		}
		if (typeof raw.salt !== 'string') {
			return drop('missing salt');
		}
		if (!isPercentage(raw.percentage)) {
			return drop('percentage must be an integer from 0 to 100');
		}
		const conditions = this.conditions(raw.conditions, path);
		if (!conditions) {
			return drop('conditions must be an array');
		}
		return {
			name: typeof raw.name === 'string' ? raw.name : name,
			type: 'rollout',
			salt: raw.salt,
			conditions,
			percentage: raw.percentage,
		};
	}
}

function isPercentage(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value >= 0 &&
		value <= 100
	);
}

/**
 * Test groups: absent means a groupless test (whose variants never match);
 * otherwise uniquely named groups with integer percentages summing to at most
 * 100. Returns a reason string when the groups are malformed.
 */
function decodeGroups(raw: unknown): TestGroup[] | undefined | string {
	if (raw === undefined || raw === null) {
		return undefined;
	}
	if (!Array.isArray(raw)) {
		return 'groups must be an array';
	}
	const groups: TestGroup[] = [];
	const names = new Set<string>();
	let total = 0;
	for (const entry of raw) {
		if (!isRecord(entry) || typeof entry.name !== 'string' || !entry.name) {
			return 'every group needs a name';
		}
		if (!isPercentage(entry.percentage)) {
			return `group "${entry.name}" percentage must be an integer from 0 to 100`;
		}
		if (names.has(entry.name)) {
			return `duplicate group "${entry.name}"`;
		}
		names.add(entry.name);
		total += entry.percentage;
		groups.push({ name: entry.name, percentage: entry.percentage });
	}
	if (total > 100) {
		return `group percentages sum to ${total}, more than 100`;
	}
	return groups;
}

/** Decode raw `config.json` text exactly as an SDK does. */
export function decodeArtifact(text: string): DecodeResult {
	const decoder = new Decoder();
	const result = (
		accepted: boolean,
		extra: Partial<DecodeResult>,
	): DecodeResult => ({
		accepted,
		skippedFlags: decoder.skippedFlags,
		unrecognizedVariants: decoder.unrecognizedVariants,
		droppedVariants: decoder.droppedVariants,
		unrecognizedConditions: decoder.unrecognizedConditions,
		droppedTests: decoder.droppedTests,
		droppedRollouts: decoder.droppedRollouts,
		...extra,
	});
	const reject = (rejection: string) => result(false, { rejection });

	let root: unknown;
	try {
		root = JSON.parse(text);
	} catch {
		return reject('not valid JSON');
	}
	if (!isRecord(root)) {
		return reject('top level is not an object');
	}
	if (root.schema_version !== SUPPORTED_SCHEMA_VERSION) {
		return reject(
			`unsupported schema_version ${JSON.stringify(root.schema_version)}`,
		);
	}
	if (typeof root.config_version !== 'string' || !root.config_version) {
		return reject('missing config_version');
	}
	if (
		typeof root.published_at !== 'string' ||
		!isValidWireValue('date', root.published_at)
	) {
		return reject('published_at is not an ISO-8601 UTC instant');
	}
	if (typeof root.app_identifier !== 'string') {
		return reject('missing app_identifier');
	}
	if (!isRecord(root.flags)) {
		return reject('flags must be an object');
	}
	for (const container of ['tests', 'rollouts'] as const) {
		const value = root[container];
		if (value !== undefined && value !== null && !isRecord(value)) {
			return reject(`${container} must be an object`);
		}
	}

	const tests: Record<string, Test> = {};
	for (const [name, raw] of Object.entries(
		(root.tests as Record<string, unknown> | undefined) ?? {},
	)) {
		const test = decoder.test(name, raw);
		if (test) {
			tests[name] = test;
		}
	}

	const rollouts: Record<string, Rollout> = {};
	for (const [name, raw] of Object.entries(
		(root.rollouts as Record<string, unknown> | undefined) ?? {},
	)) {
		const rollout = decoder.rollout(name, raw);
		if (rollout) {
			rollouts[name] = rollout;
		}
	}

	const flags: Record<string, EnvironmentFlag> = {};
	for (const [key, raw] of Object.entries(root.flags)) {
		const flag = decoder.flag(key, raw);
		if (flag) {
			flags[key] = flag;
		}
	}

	return result(true, {
		artifact: {
			schema_version: SUPPORTED_SCHEMA_VERSION,
			config_version: root.config_version,
			published_at: root.published_at,
			app_identifier: root.app_identifier,
			flags,
			tests,
			rollouts,
		},
	});
}
