/**
 * Migration: two-axis targeting.
 *  - Lowercase all stored `platform` condition values.
 *  - iPadOS is removed and mapped to `ios`. The `device_class: [tablet]` condition
 *    is appended ONLY when an `in` platform condition's values are exactly
 *    `[iPadOS]` — that's the one case where the translation is exact (iPad-only
 *    in, iPad-only out). If iOS is present alongside iPadOS, `ios` alone already
 *    covers both, so nothing is appended and nothing narrows. If iPadOS is
 *    present with some other non-iOS platform (e.g. `[iPadOS, macOS]`) there is
 *    no exact mechanical answer: appending tablet would exclude that platform's
 *    desktops/etc, and leaving it as `ios` admits iPhones. That case is left
 *    mapped-only and flagged `needsReview` for a human to split by hand.
 *  - `not_in` conditions are transformed with inverted logic: excluding iPadOS
 *    together with iOS still excludes exactly the same device set once both map
 *    to `ios`, so that's mapped normally. But `not_in [iPadOS]` alone means
 *    "everything except iPads" — there is no exact mechanical translation (`not_in
 *    [ios]` would also exclude iPhones), so that condition is left completely
 *    untransformed (including its original casing) and flagged `needsReview`; the
 *    stale `iPadOS` literal is intentionally left in place so publish validation
 *    rejects the rule until a human resolves it, instead of silently flipping its
 *    meaning.
 * Walks Flag.variants (per-env conditional variants), TestRollout.conditions, and
 * Rule.conditions.
 *
 * Dry-run (default): prints affected rows, before/after, and review flags.
 * Apply:  pass --apply to write. `npx tsx scripts/migrate-platform-values.ts [--apply]`
 */

import 'dotenv/config';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';

export const PLATFORM_VALUE_MAP: Record<string, string> = {
	iOS: 'ios',
	iPadOS: 'ios',
	macOS: 'macos',
	watchOS: 'watchos',
	tvOS: 'tvos',
	visionOS: 'visionos',
	Android: 'android',
	Web: 'web',
};

// Stored values are only ever written by the admin's fixed-option UI, so the
// canonical (pre-migration) casing is always one of PLATFORM_VALUE_MAP's keys —
// no free-text entry to defend against here.
interface StoredCondition {
	type?: string;
	operator?: string;
	values?: unknown[];
	[key: string]: unknown;
}

const TABLET_CONDITION: StoredCondition = {
	type: 'device_class',
	operator: 'in',
	values: ['tablet'],
};

const WIDENING_REASON =
	'iPadOS mapped to ios widens this rule to iPhone too — no exact translation, split manually';
const UNTRANSLATABLE_EXCLUSION_REASON =
	'untranslatable exclusion (excluded iPads without excluding iPhones); left unmigrated — resolve manually (split the rule or exclude ios and re-target via device_class). Publish validation will reject this rule until resolved.';
const UNEXPECTED_OPERATOR_REASON =
	'unexpected operator on a platform condition; left unmigrated — resolve manually';

export function migrateConditionsArray(conditions: StoredCondition[]): {
	conditions: StoredCondition[];
	changed: boolean;
	needsReview: boolean;
	reviewReasons: string[];
} {
	let changed = false;
	let appendTablet = false;
	const reviewReasons: string[] = [];

	const migrated = conditions.map((condition) => {
		if (condition.type !== 'platform' || !Array.isArray(condition.values)) {
			return condition;
		}
		const original = condition.values as string[];
		const uniqueOriginal = [...new Set(original)];
		const containsIpad = uniqueOriginal.includes('iPadOS');
		const containsIos = uniqueOriginal.includes('iOS');

		if (condition.operator === 'in') {
			const isIpadOnly = containsIpad && uniqueOriginal.length === 1;
			if (containsIpad) {
				if (isIpadOnly) {
					// Exact: iPad-only condition becomes ios + tablet.
					appendTablet = true;
				} else if (!containsIos) {
					// iPadOS with some other non-iOS platform, no iOS: no exact mechanical
					// answer. Map only, flag for a human to split.
					reviewReasons.push(WIDENING_REASON);
				}
				// iPadOS alongside iOS (± others): `ios` alone already covers iPhone and
				// iPad, so mapping without appending tablet is exact — no review needed.
			}
		} else if (condition.operator === 'not_in') {
			if (containsIpad && !containsIos) {
				// "not_in [iPadOS]" excludes iPads only. Excluding `ios` would also
				// exclude iPhones — wrong. Leave this condition entirely untouched
				// (original casing included) so it fails publish validation loudly
				// rather than silently inverting the rule.
				reviewReasons.push(UNTRANSLATABLE_EXCLUSION_REASON);
				return condition;
			}
			// iPadOS alongside iOS, or no iPadOS at all: excluding ios excludes the
			// same device set as before (iPhone + iPad already both excluded either
			// way). Falls through to the plain lowercase mapping below.
		} else {
			// Defensive: platform conditions are only ever authored with in/not_in
			// from the fixed-option UI. Anything else is unexpected — leave as-is
			// and surface it rather than guess.
			reviewReasons.push(UNEXPECTED_OPERATOR_REASON);
			return condition;
		}

		const mapped = original.map((v) => PLATFORM_VALUE_MAP[v] ?? v);
		const deduped = [...new Set(mapped)];
		if (JSON.stringify(deduped) !== JSON.stringify(original)) {
			changed = true;
		}
		return { ...condition, values: deduped };
	});

	if (appendTablet) {
		const alreadyHasTablet = migrated.some(
			(c) =>
				c.type === 'device_class' &&
				Array.isArray(c.values) &&
				(c.values as string[]).includes('tablet'),
		);
		if (!alreadyHasTablet) {
			migrated.push({ ...TABLET_CONDITION });
			changed = true;
		}
	}

	return {
		conditions: migrated,
		changed,
		needsReview: reviewReasons.length > 0,
		reviewReasons: [...new Set(reviewReasons)],
	};
}

function migrateVariantsJson(variantsJson: unknown): {
	variants: unknown;
	changed: boolean;
	needsReview: boolean;
	reviewReasons: string[];
} {
	if (!variantsJson || typeof variantsJson !== 'object') {
		return {
			variants: variantsJson,
			changed: false,
			needsReview: false,
			reviewReasons: [],
		};
	}
	let anyChanged = false;
	const reviewReasons = new Set<string>();
	const updated: Record<string, unknown> = { ...variantsJson };
	for (const env of ['development', 'beta', 'production']) {
		const envVariants = updated[env];
		if (Array.isArray(envVariants)) {
			updated[env] = envVariants.map((variant: Record<string, unknown>) => {
				if (
					Array.isArray(variant.conditions) &&
					variant.conditions.length > 0
				) {
					const {
						conditions,
						changed,
						reviewReasons: variantReasons,
					} = migrateConditionsArray(variant.conditions as StoredCondition[]);
					if (changed) {
						anyChanged = true;
					}
					for (const reason of variantReasons) {
						reviewReasons.add(reason);
					}
					if (changed) {
						return { ...variant, conditions };
					}
				}
				return variant;
			});
		}
	}
	return {
		variants: updated,
		changed: anyChanged,
		needsReview: reviewReasons.size > 0,
		reviewReasons: [...reviewReasons],
	};
}

function reviewSuffix(reviewReasons: string[]): string {
	return reviewReasons.length > 0
		? `  [REVIEW: ${reviewReasons.join('; ')}]`
		: '';
}

async function main() {
	const apply = process.argv.includes('--apply');
	console.log(`Two-axis platform migration (${apply ? 'APPLY' : 'DRY-RUN'})\n`);

	const flags = await prisma.flag.findMany();
	let flagCount = 0;
	for (const flag of flags) {
		const { variants, changed, needsReview, reviewReasons } =
			migrateVariantsJson(flag.variants);
		if (changed || needsReview) {
			flagCount++;
			console.log(`Flag ${flag.key}${reviewSuffix(reviewReasons)}`);
			if (apply && changed) {
				await prisma.flag.update({
					where: { id: flag.id },
					data: { variants: variants as Prisma.InputJsonValue },
				});
			}
		}
	}

	const testRollouts = await prisma.testRollout.findMany();
	let trCount = 0;
	for (const tr of testRollouts) {
		const stored = Array.isArray(tr.conditions)
			? (tr.conditions as unknown as StoredCondition[])
			: [];
		const { conditions, changed, needsReview, reviewReasons } =
			migrateConditionsArray(stored);
		if (changed || needsReview) {
			trCount++;
			console.log(`TestRollout ${tr.key}${reviewSuffix(reviewReasons)}`);
			if (apply && changed) {
				await prisma.testRollout.update({
					where: { id: tr.id },
					data: { conditions: conditions as unknown as Prisma.InputJsonValue },
				});
			}
		}
	}

	const rules = await prisma.rule.findMany();
	let ruleCount = 0;
	for (const rule of rules) {
		const stored = Array.isArray(rule.conditions)
			? (rule.conditions as unknown as StoredCondition[])
			: [];
		const { conditions, changed, needsReview, reviewReasons } =
			migrateConditionsArray(stored);
		if (changed || needsReview) {
			ruleCount++;
			console.log(`Rule ${rule.id}${reviewSuffix(reviewReasons)}`);
			if (apply && changed) {
				await prisma.rule.update({
					where: { id: rule.id },
					data: { conditions: conditions as unknown as Prisma.InputJsonValue },
				});
			}
		}
	}

	console.log(
		`\n${apply ? 'Migrated/flagged' : 'Would migrate/flag'}: ${flagCount} flags, ${trCount} test/rollouts, ${ruleCount} rules affected (some rows above may be review-only, no write).`,
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
