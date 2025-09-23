import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAllBrokenFlags() {
  console.log('🔧 Fixing all flags with incomplete environment data...');

  const flags = await prisma.flag.findMany({
    select: {
      id: true,
      key: true,
      displayName: true,
      type: true,
      defaultValues: true,
    }
  });

  console.log(`Found ${flags.length} flags to check.`);

  let fixedCount = 0;

  for (const flag of flags) {
    const defaultValues = flag.defaultValues as any;
    const environments = ['development', 'staging', 'production'];
    const missingEnvs = environments.filter(env => !(env in defaultValues));

    if (missingEnvs.length > 0) {
      console.log(`🔧 Fixing ${flag.key}: missing ${missingEnvs.join(', ')}`);
      console.log(`   Current: ${JSON.stringify(defaultValues)}`);

      // Get the existing value (probably from development)
      const existingValue = defaultValues.development || defaultValues.staging || defaultValues.production || false;

      console.log(`   Using ${JSON.stringify(existingValue)} as default for missing environments`);

      // Create complete defaultValues
      const fixedDefaultValues = {
        development: defaultValues.development !== undefined ? defaultValues.development : existingValue,
        staging: defaultValues.staging !== undefined ? defaultValues.staging : existingValue,
        production: defaultValues.production !== undefined ? defaultValues.production : existingValue,
      };

      console.log(`   New values: ${JSON.stringify(fixedDefaultValues)}`);

      // Update the flag
      await prisma.flag.update({
        where: { id: flag.id },
        data: {
          defaultValues: fixedDefaultValues,
          variants: defaultValues.variants || {} // Ensure variants exist
        }
      });

      console.log(`   ✅ Fixed ${flag.key}`);
      fixedCount++;
    } else {
      console.log(`✅ ${flag.key}: already OK`);
    }
  }

  if (fixedCount === 0) {
    console.log('\n🎉 All flags were already schema v2 compliant!');
  } else {
    console.log(`\n✅ Successfully fixed ${fixedCount} flags!`);
  }
}

async function main() {
  try {
    await fixAllBrokenFlags();
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

export { fixAllBrokenFlags };