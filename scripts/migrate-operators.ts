/**
 * Migration: Fix stored condition operators to match SDK ConditionOperator raw values.
 *
 * Fixes:
 * 1. 'does_not_equal' / 'not_equals' → 'does_not_equals' (SDK uses plural)
 * 2. custom_attribute conditions: move 'attribute' field value into 'values[0]'
 *
 * Run: npx ts-node --project tsconfig.scripts.json scripts/migrate-operators.ts
 * Or:  npx tsx scripts/migrate-operators.ts
 */

import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const OPERATOR_MAP: Record<string, string> = {
	does_not_equal: 'does_not_equals',
	not_equals: 'does_not_equals',
};

interface StoredCondition {
	type?: string;
	operator?: string;
	attribute?: unknown;
	values?: unknown[];
	[key: string]: unknown;
}

interface StoredVariant {
	conditions?: unknown;
	[key: string]: unknown;
}

type StoredVariantsByEnv = Record<string, unknown>;

function migrateCondition(condition: StoredCondition): {
	condition: StoredCondition;
	changed: boolean;
} {
	let changed = false;
	let updated: StoredCondition = { ...condition };

	// Fix operator value
	if (condition.operator && OPERATOR_MAP[condition.operator]) {
		updated = { ...updated, operator: OPERATOR_MAP[condition.operator] };
		changed = true;
	}

	// Move custom_attribute name from 'attribute' field to 'values[0]'
	if (
		condition.type === 'custom_attribute' &&
		condition.attribute &&
		(!condition.values || condition.values.length === 0)
	) {
		const { attribute, ...rest } = updated;
		updated = { ...rest, values: [attribute] };
		changed = true;
	}

	return { condition: updated, changed };
}

function migrateConditionArray(conditions: StoredCondition[]): {
	conditions: StoredCondition[];
	changed: boolean;
} {
	let anyChanged = false;
	const migrated = conditions.map((c) => {
		const { condition, changed } = migrateCondition(c);
		if (changed) {
			anyChanged = true;
		}
		return condition;
	});
	return { conditions: migrated, changed: anyChanged };
}

function migrateVariantsJson(variantsJson: unknown): {
	variants: unknown;
	changed: boolean;
} {
	if (!variantsJson || typeof variantsJson !== 'object') {
		return { variants: variantsJson, changed: false };
	}

	let anyChanged = false;
	const updated: StoredVariantsByEnv = { ...variantsJson };

	for (const env of ['development', 'beta', 'production']) {
		const envVariants = updated[env];
		if (Array.isArray(envVariants)) {
			updated[env] = (envVariants as StoredVariant[]).map((variant) => {
				if (
					Array.isArray(variant.conditions) &&
					variant.conditions.length > 0
				) {
					const { conditions, changed } = migrateConditionArray(
						variant.conditions as StoredCondition[],
					);
					if (changed) {
						anyChanged = true;
						return { ...variant, conditions };
					}
				}
				return variant;
			});
		}
	}

	return { variants: updated, changed: anyChanged };
}

async function migrateFlags() {
	const flags = await prisma.flag.findMany();
	let updated = 0;

	for (const flag of flags) {
		const { variants, changed } = migrateVariantsJson(flag.variants);
		if (changed) {
			await prisma.flag.update({
				where: { id: flag.id },
				data: { variants: variants as Prisma.InputJsonValue },
			});
			updated++;
		}
	}

	console.log(`Flags: migrated ${updated} of ${flags.length}`);
}

async function migrateTestRollouts() {
	const testRollouts = await prisma.testRollout.findMany();
	let updated = 0;

	for (const tr of testRollouts) {
		const conditions: StoredCondition[] = Array.isArray(tr.conditions)
			? (tr.conditions as unknown as StoredCondition[])
			: [];
		const { conditions: migrated, changed } = migrateConditionArray(conditions);
		if (changed) {
			await prisma.testRollout.update({
				where: { id: tr.id },
				data: { conditions: migrated as Prisma.InputJsonValue },
			});
			updated++;
		}
	}

	console.log(`TestRollouts: migrated ${updated} of ${testRollouts.length}`);
}

async function main() {
	console.log('Starting operator migration...\n');

	await migrateFlags();
	await migrateTestRollouts();

	console.log('\nMigration complete.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
