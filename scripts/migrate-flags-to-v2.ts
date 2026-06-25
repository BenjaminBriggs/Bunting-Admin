import 'dotenv/config';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';

interface StoredDefaults {
	development?: unknown;
	beta?: unknown;
	production?: unknown;
	defaultValue?: unknown;
	[key: string]: unknown;
}

async function migrateFlagsToV2() {
	console.log('🔍 Checking flags for schema v2 compliance...');

	const flags = await prisma.flag.findMany({
		select: {
			id: true,
			key: true,
			displayName: true,
			type: true,
			defaultValues: true,
			appId: true,
		},
	});

	console.log(`Found ${flags.length} flags to check.`);

	const flagsToMigrate: Array<(typeof flags)[number]> = [];

	for (const flag of flags) {
		const defaultValues = flag.defaultValues as unknown as
			| StoredDefaults
			| null
			| undefined;

		// Check if this flag has the old schema (single defaultValue) or incomplete v2 schema
		const needsMigration =
			!defaultValues ||
			typeof defaultValues !== 'object' ||
			!defaultValues.development ||
			!defaultValues.beta ||
			!defaultValues.production;

		if (needsMigration) {
			console.log(`❌ Flag "${flag.key}" needs migration:`, {
				id: flag.id,
				currentDefaultValues: defaultValues,
			});
			flagsToMigrate.push(flag);
		} else {
			console.log(`✅ Flag "${flag.key}" is v2 compliant`);
		}
	}

	if (flagsToMigrate.length === 0) {
		console.log('🎉 All flags are already v2 compliant!');
		return;
	}

	console.log(`\n🔧 Migrating ${flagsToMigrate.length} flags to schema v2...`);

	for (const flag of flagsToMigrate) {
		const defaultValues = flag.defaultValues as unknown as
			| StoredDefaults
			| null
			| undefined;

		// Try to determine what the default value should be
		let newDefaultValue: unknown;

		if (
			defaultValues &&
			typeof defaultValues === 'object' &&
			'defaultValue' in defaultValues
		) {
			// Old schema format: { defaultValue: any }
			newDefaultValue = defaultValues.defaultValue;
		} else if (defaultValues !== null && defaultValues !== undefined) {
			// Direct value stored
			newDefaultValue = defaultValues;
		} else {
			// No default value, use type-appropriate default
			switch (flag.type) {
				case 'BOOL':
					newDefaultValue = false;
					break;
				case 'STRING':
					newDefaultValue = '';
					break;
				case 'INT':
				case 'DOUBLE':
					newDefaultValue = 0;
					break;
				case 'DATE':
					newDefaultValue = new Date().toISOString();
					break;
				case 'JSON':
					newDefaultValue = '{}';
					break;
				default:
					newDefaultValue = null;
			}
		}

		const newDefaultValues = {
			development: newDefaultValue,
			beta: newDefaultValue,
			production: newDefaultValue,
		};

		console.log(`  Migrating "${flag.key}":`, {
			from: defaultValues,
			to: newDefaultValues,
		});

		await prisma.flag.update({
			where: { id: flag.id },
			data: {
				defaultValues: newDefaultValues as Prisma.InputJsonValue,
				variants: {}, // Reset variants to empty object for each environment
			},
		});

		console.log(`  ✅ Migrated "${flag.key}"`);
	}

	console.log(
		`\n🎉 Successfully migrated ${flagsToMigrate.length} flags to schema v2!`,
	);
}

async function main() {
	try {
		await migrateFlagsToV2();
	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

if (require.main === module) {
	void main();
}

export { migrateFlagsToV2 };
