import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllFlags() {
	console.log('🔍 Checking all flags for schema v2 compliance...');

	const flags = await prisma.flag.findMany({
		select: {
			id: true,
			key: true,
			displayName: true,
			type: true,
			defaultValues: true,
		},
	});

	console.log(`Found ${flags.length} flags to check.`);

	let brokenCount = 0;

	for (const flag of flags) {
		const defaultValues = flag.defaultValues as any;
		const environments = ['development', 'beta', 'production'];
		const missingEnvs = environments.filter((env) => !(env in defaultValues));

		if (missingEnvs.length > 0) {
			console.log(`❌ ${flag.key}: missing ${missingEnvs.join(', ')}`);
			console.log(`   Current: ${JSON.stringify(defaultValues)}`);
			brokenCount++;
		} else {
			console.log(`✅ ${flag.key}: OK`);
		}
	}

	if (brokenCount === 0) {
		console.log('\n🎉 All flags are schema v2 compliant!');
	} else {
		console.log(`\n⚠️  Found ${brokenCount} flags that need fixing`);
	}
}

async function main() {
	try {
		await checkAllFlags();
	} catch (error) {
		console.error('❌ Check failed:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

if (require.main === module) {
	main();
}

export { checkAllFlags };
