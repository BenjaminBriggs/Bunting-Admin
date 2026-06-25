import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBrokenFlag() {
	console.log('🔍 Checking for the broken flag...');

	// Find the problematic flag
	const flag = await prisma.flag.findFirst({
		where: {
			key: 'listen_to_articles_enabled',
		},
		select: {
			id: true,
			key: true,
			displayName: true,
			type: true,
			defaultValues: true,
		},
	});

	if (!flag) {
		console.log('❌ Flag "listen_to_articles_enabled" not found');
		return;
	}

	console.log('Found flag:', {
		id: flag.id,
		key: flag.key,
		currentDefaultValues: flag.defaultValues,
	});

	const defaultValues = flag.defaultValues as any;

	// Check if it's missing environment values
	const environments = ['development', 'beta', 'production'];
	const missingEnvs = environments.filter((env) => !(env in defaultValues));

	if (missingEnvs.length === 0) {
		console.log('✅ Flag is already properly formatted');
		return;
	}

	console.log(`❌ Flag is missing values for: ${missingEnvs.join(', ')}`);

	// Get the existing value (probably from development)
	const existingValue =
		defaultValues.development ||
		defaultValues.beta ||
		defaultValues.production ||
		false;

	console.log(`Using ${existingValue} as default for missing environments`);

	// Create complete defaultValues
	const fixedDefaultValues = {
		development:
			defaultValues.development !== undefined
				? defaultValues.development
				: existingValue,
		beta: defaultValues.beta !== undefined ? defaultValues.beta : existingValue,
		production:
			defaultValues.production !== undefined
				? defaultValues.production
				: existingValue,
	};

	console.log('Updating flag with:', fixedDefaultValues);

	// Update the flag
	await prisma.flag.update({
		where: { id: flag.id },
		data: {
			defaultValues: fixedDefaultValues,
			variants: defaultValues.variants || {}, // Ensure variants exist
		},
	});

	console.log('✅ Flag fixed successfully!');
}

async function main() {
	try {
		await fixBrokenFlag();
	} catch (error) {
		console.error('❌ Fix failed:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

if (require.main === module) {
	main();
}

export { fixBrokenFlag };
