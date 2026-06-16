/**
 * Migration: Fix stored condition operators to match SDK ConditionOperator raw values.
 *
 * Fixes:
 * 1. 'does_not_equal' / 'not_equals' → 'does_not_equals' (SDK uses plural)
 * 2. 'is_in_cohort' → 'in' and 'is_not_in_cohort' → 'not_in' (cohort conditions)
 * 3. custom_attribute conditions: move 'attribute' field value into 'values[0]'
 *
 * Run: npx ts-node --project tsconfig.scripts.json scripts/migrate-operators.ts
 * Or:  npx tsx scripts/migrate-operators.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OPERATOR_MAP: Record<string, string> = {
	does_not_equal: 'does_not_equals',
	not_equals: 'does_not_equals',
	is_in_cohort: 'in',
	is_not_in_cohort: 'not_in',
};

function migrateCondition(condition: any): {
	condition: any;
	changed: boolean;
} {
	let changed = false;
	let updated = { ...condition };

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

function migrateConditionArray(conditions: any[]): {
	conditions: any[];
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

function migrateVariantsJson(variantsJson: any): {
	variants: any;
	changed: boolean;
} {
	if (!variantsJson || typeof variantsJson !== 'object') {
		return { variants: variantsJson, changed: false };
	}

	let anyChanged = false;
	const updated = { ...variantsJson };

	for (const env of ['development', 'staging', 'production']) {
		if (Array.isArray(updated[env])) {
			updated[env] = updated[env].map((variant: any) => {
				if (
					Array.isArray(variant.conditions) &&
					variant.conditions.length > 0
				) {
					const { conditions, changed } = migrateConditionArray(
						variant.conditions,
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
			await prisma.flag.update({ where: { id: flag.id }, data: { variants } });
			updated++;
		}
	}

	console.log(`Flags: migrated ${updated} of ${flags.length}`);
}

async function migrateCohorts() {
	const cohorts = await prisma.cohort.findMany();
	let updated = 0;

	for (const cohort of cohorts) {
		const conditions = Array.isArray(cohort.conditions)
			? cohort.conditions
			: [];
		const { conditions: migrated, changed } = migrateConditionArray(
			conditions as any[],
		);
		if (changed) {
			await prisma.cohort.update({
				where: { id: cohort.id },
				data: { conditions: migrated },
			});
			updated++;
		}
	}

	console.log(`Cohorts: migrated ${updated} of ${cohorts.length}`);
}

async function migrateTestRollouts() {
	const testRollouts = await prisma.testRollout.findMany();
	let updated = 0;

	for (const tr of testRollouts) {
		const conditions = Array.isArray(tr.conditions) ? tr.conditions : [];
		const { conditions: migrated, changed } = migrateConditionArray(
			conditions as any[],
		);
		if (changed) {
			await prisma.testRollout.update({
				where: { id: tr.id },
				data: { conditions: migrated },
			});
			updated++;
		}
	}

	console.log(`TestRollouts: migrated ${updated} of ${testRollouts.length}`);
}

async function main() {
	console.log('Starting operator migration...\n');

	await migrateFlags();
	await migrateCohorts();
	await migrateTestRollouts();

	console.log('\nMigration complete.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
