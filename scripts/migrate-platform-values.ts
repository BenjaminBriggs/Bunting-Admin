/**
 * Migration: two-axis targeting.
 *  - Lowercase all stored `platform` condition values.
 *  - iPadOS is removed: map it to `ios` and, on any conditions array that had an
 *    iPadOS-bearing platform condition, append `device_class: [tablet]` so the
 *    rule still targets iPads.
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

export function migrateConditionsArray(conditions: StoredCondition[]): {
	conditions: StoredCondition[];
	changed: boolean;
	needsReview: boolean;
} {
	let changed = false;
	let hadIpad = false;
	let needsReview = false;

	const migrated = conditions.map((condition) => {
		if (condition.type !== 'platform' || !Array.isArray(condition.values)) {
			return condition;
		}
		const original = condition.values as string[];
		const containsIpad = original.includes('iPadOS');
		if (containsIpad) {
			hadIpad = true;
			if (original.some((v) => v !== 'iPadOS')) {
				needsReview = true;
			}
		}
		const mapped = original.map((v) => PLATFORM_VALUE_MAP[v] ?? v);
		const deduped = [...new Set(mapped)];
		if (JSON.stringify(deduped) !== JSON.stringify(original)) {
			changed = true;
		}
		return { ...condition, values: deduped };
	});

	if (hadIpad) {
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

	return { conditions: migrated, changed, needsReview };
}

function migrateVariantsJson(variantsJson: unknown): {
	variants: unknown;
	changed: boolean;
	needsReview: boolean;
} {
	if (!variantsJson || typeof variantsJson !== 'object') {
		return { variants: variantsJson, changed: false, needsReview: false };
	}
	let anyChanged = false;
	let anyReview = false;
	const updated: Record<string, unknown> = { ...variantsJson };
	for (const env of ['development', 'beta', 'production']) {
		const envVariants = updated[env];
		if (Array.isArray(envVariants)) {
			updated[env] = envVariants.map((variant: Record<string, unknown>) => {
				if (
					Array.isArray(variant.conditions) &&
					variant.conditions.length > 0
				) {
					const { conditions, changed, needsReview } = migrateConditionsArray(
						variant.conditions as StoredCondition[],
					);
					if (changed) {
						anyChanged = true;
					}
					if (needsReview) {
						anyReview = true;
					}
					if (changed) {
						return { ...variant, conditions };
					}
				}
				return variant;
			});
		}
	}
	return { variants: updated, changed: anyChanged, needsReview: anyReview };
}

async function main() {
	const apply = process.argv.includes('--apply');
	console.log(`Two-axis platform migration (${apply ? 'APPLY' : 'DRY-RUN'})\n`);

	const flags = await prisma.flag.findMany();
	let flagCount = 0;
	for (const flag of flags) {
		const { variants, changed, needsReview } = migrateVariantsJson(
			flag.variants,
		);
		if (changed) {
			flagCount++;
			console.log(
				`Flag ${flag.key}${needsReview ? '  [REVIEW: combined iPhone+iPad rule narrowed to tablet]' : ''}`,
			);
			if (apply) {
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
		const { conditions, changed, needsReview } = migrateConditionsArray(stored);
		if (changed) {
			trCount++;
			console.log(`TestRollout ${tr.key}${needsReview ? '  [REVIEW]' : ''}`);
			if (apply) {
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
		const { conditions, changed, needsReview } = migrateConditionsArray(stored);
		if (changed) {
			ruleCount++;
			console.log(`Rule ${rule.id}${needsReview ? '  [REVIEW]' : ''}`);
			if (apply) {
				await prisma.rule.update({
					where: { id: rule.id },
					data: { conditions: conditions as unknown as Prisma.InputJsonValue },
				});
			}
		}
	}

	console.log(
		`\n${apply ? 'Migrated' : 'Would migrate'}: ${flagCount} flags, ${trCount} test/rollouts, ${ruleCount} rules.`,
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
