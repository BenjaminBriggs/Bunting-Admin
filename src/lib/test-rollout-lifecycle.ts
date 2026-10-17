/**
 * Finishing a test or rollout: complete (bake the outcome into the attached
 * flags, then archive) or abandon (archive without baking).
 *
 * Archiving alone drops the test/rollout from the generated artifact, so its
 * flag variants disappear and every user falls back to the flag default. That
 * is the right effect for abandoning, but completing must keep serving the
 * shipped value, so it is written into the flags themselves:
 *
 * - no entry conditions: the value becomes the flag's default in each
 *   environment where the test/rollout supplies one;
 * - entry conditions: a conditional variant with those conditions and the value
 *   takes the test/rollout's place in the variant order.
 *
 * The bake reads the generated artifact (inside the same transaction) for the
 * per-flag/per-environment values and the variant order, so it resolves values
 * exactly as publishing does. When the result would not evaluate the same as
 * the test/rollout at 100% for its eligible users, completion is refused with a
 * 409 instead of guessing. Either way the change is a draft until the next
 * publish, like any other edit.
 */
import type { Prisma, TestRollout } from '@/generated/prisma/client';
import { generateConfigFromDb } from '@/lib/config-generator';
import {
	normalizeFlagType,
	validateFlagValue,
	type ValidFlagType,
} from '@/lib/config-validation';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/utils';
import type {
	ConditionalVariant,
	ConfigArtifact,
	Environment,
	FlagValue,
	FlagVariant,
} from '@/types';

const ENVIRONMENTS: Environment[] = ['development', 'beta', 'production'];

export class TestRolloutLifecycleError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 404 | 409,
	) {
		super(message);
		this.name = 'TestRolloutLifecycleError';
	}
}

// Finished records stay finished: a completion already baked its outcome into
// the flags, so reactivating it would serve the value twice over, and an
// abandoned one would come back at 0%. Update routes refuse `archived: false`
// for any record with an outcome (records archived before outcomes were
// recorded can still be unarchived).
export const REACTIVATE_FINISHED_MESSAGE =
	'This test or rollout is finished (completed or abandoned) and cannot be reactivated. Create a new one instead.';

/** One flag environment changed by a completion, recorded in the activity log. */
export interface BakedChange {
	flagId: string;
	flagKey: string;
	environment: Environment;
	/** `default`: the environment default was replaced. `conditional`: a variant was added. */
	kind: 'default' | 'conditional';
	value: FlagValue;
	previousDefault?: FlagValue;
	variantId?: string;
}

export interface CompletionResult {
	testRollout: TestRollout;
	baked: BakedChange[];
}

// Stored conditional variants, as loosely as the generator reads them (older
// rows may lack `order`).
type StoredVariantsByEnv = Partial<
	Record<Environment, Array<Partial<ConditionalVariant>>>
>;

function label(record: Pick<TestRollout, 'type'>): 'test' | 'rollout' {
	return record.type === 'TEST' ? 'test' : 'rollout';
}

function alreadyFinished(record: TestRollout): TestRolloutLifecycleError {
	const state =
		record.outcome === 'COMPLETED'
			? 'completed'
			: record.outcome === 'ABANDONED'
				? 'abandoned'
				: 'archived';
	return new TestRolloutLifecycleError(
		`This ${label(record)} is already ${state}.`,
		409,
	);
}

// The generated variant this test/rollout contributes to a flag environment.
function isOwnVariant(record: TestRollout, variant: FlagVariant): boolean {
	return record.type === 'TEST'
		? variant.type === 'test' && variant.test === record.key
		: variant.type === 'rollout' && variant.rollout === record.key;
}

// Keys of the other tests/rollouts among `variants` (conditionals and this
// record's own variant, should it be attached twice, excluded).
function otherTestRollouts(
	record: TestRollout,
	variants: FlagVariant[],
): string[] {
	return variants
		.filter((v) => v.type !== 'conditional' && !isOwnVariant(record, v))
		.map((v) => `"${v.test ?? v.rollout}"`);
}

/**
 * Complete a test or rollout: bake its outcome into every attached flag and
 * archive it with outcome COMPLETED, in one transaction. Tests must name a
 * `winner` group. Throws TestRolloutLifecycleError (400/404/409) on refusal;
 * nothing is written in that case.
 */
export async function completeTestRollout(
	id: string,
	winner?: string,
): Promise<CompletionResult> {
	return prisma.$transaction(async (tx) => {
		// Lock the row so concurrent completes (or a complete racing an abandon)
		// cannot both act on the same active record.
		await tx.$queryRaw`SELECT id FROM "test_rollouts" WHERE id = ${id} FOR UPDATE`;
		const record = await tx.testRollout.findUnique({ where: { id } });
		if (!record) {
			throw new TestRolloutLifecycleError('Test/Rollout not found', 404);
		}
		if (record.archived) {
			throw alreadyFinished(record);
		}

		const kind = label(record);
		if (record.type === 'TEST') {
			const groups = Object.keys(
				(record.variants ?? {}) as Record<string, unknown>,
			);
			if (!winner) {
				throw new TestRolloutLifecycleError(
					`Completing a test requires a winner: one of its groups (${groups.join(', ')}).`,
					400,
				);
			}
			if (!groups.includes(winner)) {
				throw new TestRolloutLifecycleError(
					`"${winner}" is not a group of this test. Choose one of: ${groups.join(', ')}.`,
					400,
				);
			}
		} else if (winner !== undefined) {
			throw new TestRolloutLifecycleError(
				'Rollouts have no groups, so they take no winner.',
				400,
			);
		}

		let config: ConfigArtifact;
		try {
			config = await generateConfigFromDb(record.appId, tx);
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			throw new TestRolloutLifecycleError(
				`Cannot complete this ${kind} because the app's config cannot be generated: ${reason}`,
				409,
			);
		}

		const flagIds = (record.flagIds as string[] | null) ?? [];
		const flags = await tx.flag.findMany({
			where: { appId: record.appId, id: { in: flagIds } },
			orderBy: { key: 'asc' },
		});
		const conditions =
			(record.conditions as unknown as
				| ConditionalVariant['conditions']
				| null) ?? [];
		const hasConditions = conditions.length > 0;

		const conflicts: string[] = [];
		const updates: Array<{
			flagId: string;
			defaultValues: Record<Environment, FlagValue>;
			variants: StoredVariantsByEnv;
		}> = [];
		const baked: BakedChange[] = [];

		for (const flag of flags) {
			const flagConfig = Object.hasOwn(config.flags, flag.key)
				? config.flags[flag.key]
				: undefined;
			if (!flagConfig) {
				continue;
			}
			const flagType = normalizeFlagType(flag.type) as ValidFlagType;
			const defaultValues = {
				...(flag.defaultValues as Record<Environment, FlagValue>),
			};
			const variants = {
				...((flag.variants ?? {}) as StoredVariantsByEnv),
			};
			const flagBaked: BakedChange[] = [];

			for (const env of ENVIRONMENTS) {
				const generated = flagConfig[env].variants ?? [];
				const index = generated.findIndex((v) => isOwnVariant(record, v));
				if (index === -1) {
					continue; // supplies no value for this flag in this environment
				}
				const where = `flag "${flag.key}" (${env})`;

				const own = generated[index];
				const value =
					record.type === 'TEST' ? own.values?.[winner ?? ''] : own.value;
				if (value === undefined) {
					// Contract rule C3: a user bucketed into a group with no value in
					// this variant is not in the test here and falls through to the
					// next variant or the default. At 100% winner the variant
					// contributes nothing, so there is nothing to bake.
					continue;
				}

				if (flag.archived) {
					conflicts.push(
						`${where} is archived and locked; unarchive it before completing`,
					);
					break;
				}
				if (!validateFlagValue(flagType, value)) {
					conflicts.push(
						`${where} would get ${JSON.stringify(value)}, which is not a valid ${flagType} value`,
					);
					continue;
				}

				if (hasConditions) {
					// Stored conditionals always precede generated test/rollout
					// variants, so a conditional only keeps this position when no
					// other test or rollout is evaluated before this one.
					const ahead = otherTestRollouts(record, generated.slice(0, index));
					if (ahead.length > 0) {
						conflicts.push(
							`${where} evaluates ${ahead.join(', ')} first, and a conditional variant would move ahead of it`,
						);
						continue;
					}
					const list = [...(variants[env] ?? [])];
					const order =
						list.length > 0 ? Math.max(...list.map((v) => v.order ?? 0)) : 0;
					const variant: ConditionalVariant = {
						id: generateId(),
						name:
							record.type === 'TEST'
								? `Completed test ${record.key} (${winner})`
								: `Completed rollout ${record.key}`,
						type: 'conditional',
						conditions,
						value,
						order: order + 1,
					};
					list.push(variant);
					variants[env] = list;
					flagBaked.push({
						flagId: flag.id,
						flagKey: flag.key,
						environment: env,
						kind: 'conditional',
						value,
						variantId: variant.id,
					});
				} else {
					// At 100% with no entry conditions nothing after this variant is
					// reachable; as the default, anything after it would be.
					const behind = otherTestRollouts(record, generated.slice(index + 1));
					if (behind.length > 0) {
						conflicts.push(
							`${where} evaluates ${behind.join(', ')} after this ${kind}, and it would start receiving users`,
						);
						continue;
					}
					flagBaked.push({
						flagId: flag.id,
						flagKey: flag.key,
						environment: env,
						kind: 'default',
						value,
						previousDefault: defaultValues[env],
					});
					defaultValues[env] = value;
				}
			}

			if (flagBaked.length > 0) {
				updates.push({ flagId: flag.id, defaultValues, variants });
				baked.push(...flagBaked);
			}
		}

		if (conflicts.length > 0) {
			throw new TestRolloutLifecycleError(
				`Cannot complete this ${kind} without changing what users get: ${conflicts.join('; ')}.`,
				409,
			);
		}

		for (const update of updates) {
			await tx.flag.update({
				where: { id: update.flagId },
				data: {
					defaultValues: update.defaultValues,
					variants: update.variants as unknown as Prisma.InputJsonValue,
				},
			});
		}

		const now = new Date();
		const testRollout = await tx.testRollout.update({
			where: { id },
			data: {
				archived: true,
				archivedAt: now,
				outcome: 'COMPLETED',
				completedAt: now,
				winner: record.type === 'TEST' ? winner : null,
				// A completed rollout reached everyone it targets.
				...(record.type === 'ROLLOUT' ? { percentage: 100 } : {}),
			},
		});

		return { testRollout, baked };
	});
}

/**
 * Abandon a test or rollout: archive it with outcome ABANDONED and nothing
 * baked, so its users return to what the flags serve without it. Rollouts are
 * set to 0%. Throws TestRolloutLifecycleError (404/409).
 */
export async function abandonTestRollout(id: string): Promise<TestRollout> {
	const record = await prisma.testRollout.findUnique({ where: { id } });
	if (!record) {
		throw new TestRolloutLifecycleError('Test/Rollout not found', 404);
	}
	if (record.archived) {
		throw alreadyFinished(record);
	}

	// Conditional on still being active, so an abandon racing a complete cannot
	// overwrite the COMPLETED outcome.
	const { count } = await prisma.testRollout.updateMany({
		where: { id, archived: false },
		data: {
			archived: true,
			archivedAt: new Date(),
			outcome: 'ABANDONED',
			...(record.type === 'ROLLOUT' ? { percentage: 0 } : {}),
		},
	});
	const updated = await prisma.testRollout.findUnique({ where: { id } });
	if (!updated) {
		throw new TestRolloutLifecycleError('Test/Rollout not found', 404);
	}
	if (count === 0) {
		throw alreadyFinished(updated);
	}
	return updated;
}
