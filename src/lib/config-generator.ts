import { normalizeFlagType } from '@/lib/config-validation';
import { prisma } from '@/lib/db';
import { validateIdentifierKey } from '@/lib/validation';
import type {
	Condition,
	ConfigArtifact,
	Environment,
	EnvironmentFlag,
	FlagType,
	FlagValue,
	FlagVariant,
	Rollout,
	Test,
	TestGroup,
} from '@/types';

const ENVIRONMENTS: Environment[] = ['development', 'beta', 'production'];

// Thrown when a config operation targets an app that no longer exists. This is an
// expected condition (e.g. an empty DB, or a stale client selection), not a server
// fault — routes map it to a 404, not a 500.
export class AppNotFoundError extends Error {
	constructor(appId: string) {
		super(`App not found: ${appId}`);
		this.name = 'AppNotFoundError';
	}
}

// --- Stored JSON shapes (how flag/test/rollout config is persisted in Postgres
// JSON columns). These are cast at the boundary and then handled with real types.
type StoredCondition = Record<string, unknown>;

interface StoredConditionalVariant {
	order?: number;
	value?: FlagValue;
	conditions?: StoredCondition[];
}

interface StoredVariantsByEnv {
	development?: StoredConditionalVariant[];
	beta?: StoredConditionalVariant[];
	production?: StoredConditionalVariant[];
}

type StoredDefaults = Record<Environment, FlagValue>;

// A stored value is either a direct FlagValue or a per-flag map { flagId: value }.
type StoredAssignedValue = FlagValue | Record<string, FlagValue> | null;

interface StoredTestVariant {
	percentage?: number;
	values?: Partial<Record<Environment, StoredAssignedValue>>;
}

type StoredTestVariants = Record<string, StoredTestVariant>;
type StoredRolloutValues = Partial<Record<Environment, StoredAssignedValue>>;

// Bridge legacy conditions that stored custom_attribute name in `attribute` field.
// SDK reads values[0] as the attribute name — migrate on the fly until DB is updated.
function normalizeCondition(condition: StoredCondition): Condition {
	// Strip the legacy `id` field — it was only ever a React UI key and must not
	// appear in the published artifact (older DB rows may still carry it).
	const { id: _id, ...rest } = condition;
	if (
		rest.type === 'custom_attribute' &&
		typeof rest.attribute === 'string' &&
		(!Array.isArray(rest.values) || rest.values.length === 0)
	) {
		const { attribute, ...clean } = rest;
		return { ...clean, values: [attribute] } as unknown as Condition;
	}
	return rest as unknown as Condition;
}

// Resolve a stored assigned value to this flag's value: a per-flag map yields the
// flag-specific entry (undefined if absent → caller skips), a primitive is used
// directly, an array/object without the flag id yields undefined.
function resolveFlagSpecificValue(
	stored: StoredAssignedValue | undefined,
	flagId: string,
): FlagValue | undefined {
	if (stored === null || stored === undefined) {
		return undefined;
	}
	if (typeof stored === 'object') {
		return (stored as Record<string, FlagValue>)[flagId];
	}
	return stored;
}

function highestOrder(variants: FlagVariant[]): number {
	return variants.length > 0
		? Math.max(...variants.map((v) => v.order))
		: 0;
}

export async function generateConfigFromDb(
	appId: string,
): Promise<ConfigArtifact> {
	// Get app info with all related data
	const app = await prisma.app.findUnique({
		where: { id: appId },
		include: {
			// Archived flags stay in the artifact marked `deprecated` (see below) so
			// SDK consumers get a deprecation signal before the flag is deleted.
			flags: {
				orderBy: { key: 'asc' },
			},
			testRollouts: {
				where: { archived: false },
				orderBy: { key: 'asc' },
			},
		},
	});

	if (!app) {
		throw new AppNotFoundError(appId);
	}

	// Transform flags with environment-specific values
	const flags: Record<string, EnvironmentFlag> = {};
	app.flags.forEach((flag) => {
		// Validate flag structure
		if (!flag.defaultValues || typeof flag.defaultValues !== 'object') {
			throw new Error(
				`Flag "${flag.key}" has invalid defaultValues structure. Expected object with development/beta/production keys. ` +
					`Current value: ${JSON.stringify(flag.defaultValues)}. ` +
					`This flag may need migration to schema v1.`,
			);
		}

		const defaults = flag.defaultValues as unknown as StoredDefaults;
		for (const env of ENVIRONMENTS) {
			if (!(env in defaults)) {
				throw new Error(
					`Flag "${flag.key}" is missing default value for environment "${env}". ` +
						`Current defaultValues: ${JSON.stringify(flag.defaultValues)}. ` +
						`This flag may need migration to schema v1.`,
				);
			}
		}

		// Validate flag key per JSON Spec
		const keyValidation = validateIdentifierKey(flag.key);
		if (!keyValidation.valid) {
			throw new Error(`Invalid flag key "${flag.key}": ${keyValidation.error}`);
		}

		// Normalize Prisma enum to lowercase (Prisma returns 'BOOL', we want 'bool')
		const jsonSpecType = normalizeFlagType(flag.type) as FlagType;

		const storedVariants = (flag.variants ?? {}) as unknown as StoredVariantsByEnv;
		const conditionalVariants = (
			list: StoredConditionalVariant[] | undefined,
		): FlagVariant[] =>
			(list ?? []).map((variant) => ({
				type: 'conditional',
				order: variant.order ?? 0,
				value: variant.value,
				conditions: (variant.conditions ?? []).map(normalizeCondition),
			}));

		flags[flag.key] = {
			type: jsonSpecType,
			description: flag.description ?? '',
			development: {
				default: defaults.development,
				variants: conditionalVariants(storedVariants.development),
			},
			beta: {
				default: defaults.beta,
				variants: conditionalVariants(storedVariants.beta),
			},
			production: {
				default: defaults.production,
				variants: conditionalVariants(storedVariants.production),
			},
		};

		// Archived flags ship with a deprecation marker; the SDK codegen emits
		// @available(*, deprecated) and the runtime fires a delegate on read.
		if (flag.archived) {
			flags[flag.key].deprecated = true;
		}
	});

	// Transform tests and rollouts per JSON Spec
	const tests: Record<string, Test> = {};
	const rollouts: Record<string, Rollout> = {};

	app.testRollouts.forEach((testRollout) => {
		// Validate test/rollout key per JSON Spec
		const keyValidation = validateIdentifierKey(testRollout.key);
		if (!keyValidation.valid) {
			throw new Error(
				`Invalid test/rollout key "${testRollout.key}": ${keyValidation.error}`,
			);
		}

		const conditions = (
			(testRollout.conditions as StoredCondition[] | null) ?? []
		).map(normalizeCondition);

		if (testRollout.type === 'TEST') {
			// Derive groups from variants — SDK needs groups to do deterministic bucketing
			const variants = (testRollout.variants ??
				{}) as unknown as StoredTestVariants;
			const groups: TestGroup[] = Object.entries(variants).map(
				([name, v]) => ({
					name,
					percentage: v.percentage ?? 0,
				}),
			);

			tests[testRollout.key] = {
				name: testRollout.name,
				description: testRollout.description ?? undefined,
				type: 'test',
				salt: testRollout.salt,
				conditions,
				...(groups.length > 0 ? { groups } : {}),
			};

			// Add test variants to assigned flags
			const assignedFlagIds = (testRollout.flagIds as string[] | null) ?? [];
			assignedFlagIds.forEach((flagId) => {
				// Find the flag by ID
				const flag = app.flags.find((f) => f.id === flagId);
				if (!flag) {
					return;
				}

				// Add test variant to each environment that has variant values
				ENVIRONMENTS.forEach((env) => {
					// For tests, build variants from the test variant definitions. Test
					// values are stored per variant but we need flag-specific values.
					const testVariantValues: Record<string, FlagValue> = {};
					Object.keys(variants).forEach((variantName) => {
						const variantData = variants[variantName];
						const stored = variantData.values?.[env];
						if (stored === null || stored === undefined) {
							return;
						}
						const value = resolveFlagSpecificValue(stored, flag.id);
						if (value !== undefined) {
							testVariantValues[variantName] = value;
						}
					});

					// Only add test variant if we have actual values (not null)
					if (Object.keys(testVariantValues).length > 0) {
						const currentVariants = flags[flag.key][env].variants ?? [];
						currentVariants.push({
							type: 'test',
							order: highestOrder(currentVariants) + 10, // after conditionals
							test: testRollout.key,
							values: testVariantValues,
						});
						flags[flag.key][env].variants = currentVariants;
					}
				});
			});
		} else {
			rollouts[testRollout.key] = {
				name: testRollout.name,
				description: testRollout.description ?? undefined,
				type: 'rollout',
				salt: testRollout.salt,
				conditions,
				percentage: testRollout.percentage ?? 0,
			};

			// Add rollout variants to assigned flags
			const rolloutValues = testRollout.rolloutValues as StoredRolloutValues | null;
			if (!rolloutValues) {
				return;
			}
			const assignedFlagIds = (testRollout.flagIds as string[] | null) ?? [];
			assignedFlagIds.forEach((flagId) => {
				// Find the flag by ID
				const flag = app.flags.find((f) => f.id === flagId);
				if (!flag) {
					return;
				}

				// Add rollout variant to each environment
				ENVIRONMENTS.forEach((env) => {
					const stored = rolloutValues[env];
					if (stored === null || stored === undefined) {
						return;
					}
					const value = resolveFlagSpecificValue(stored, flag.id);
					if (value === undefined) {
						return; // no value for this flag, skip
					}

					const currentVariants = flags[flag.key][env].variants ?? [];
					currentVariants.push({
						type: 'rollout',
						order: highestOrder(currentVariants) + 10, // after conditionals/tests
						rollout: testRollout.key,
						value,
					});
					flags[flag.key][env].variants = currentVariants;
				});
			});
		}
	});

	// Sort all variants by order
	Object.keys(flags).forEach((flagKey) => {
		ENVIRONMENTS.forEach((env) => {
			flags[flagKey][env].variants?.sort((a, b) => a.order - b.order);
		});
	});

	// Generate the corrected config artifact
	const config: ConfigArtifact = {
		schema_version: 1,
		config_version: '', // Will be set during publishing
		published_at: '', // Will be set during publishing
		app_identifier: app.identifier,
		flags,
		tests,
		rollouts,
	};

	return config;
}
