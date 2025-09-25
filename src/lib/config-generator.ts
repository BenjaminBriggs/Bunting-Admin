import { prisma } from '@/lib/db';
import { ConfigArtifact, Environment, Test, Rollout } from '@/types';
import { validateIdentifierKey } from '@/lib/validation';
const { normalizeFlagType } = require('@/lib/config-validation');

export async function generateConfigFromDb(appId: string): Promise<ConfigArtifact> {
  // Get app info with all related data
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: {
      flags: {
        where: { archived: false },
        orderBy: { key: 'asc' }
      },
      cohorts: {
        orderBy: { key: 'asc' }
      },
      testRollouts: {
        where: { archived: false },
        orderBy: { key: 'asc' }
      }
    }
  });

  if (!app) {
    throw new Error('App not found');
  }

  // Transform cohorts (top-level, no environment differences)
  const cohorts: Record<string, any> = {};
  app.cohorts.forEach((cohort: any) => {
    cohorts[cohort.key] = {
      name: cohort.name,
      description: cohort.description || '',
      conditions: cohort.conditions || []
    };
  });

  // Transform flags with environment-specific values
  const flags: Record<string, any> = {};
  app.flags.forEach((flag: any) => {
    // Validate flag structure
    if (!flag.defaultValues || typeof flag.defaultValues !== 'object') {
      throw new Error(
        `Flag "${flag.key}" has invalid defaultValues structure. Expected object with development/staging/production keys. ` +
        `Current value: ${JSON.stringify(flag.defaultValues)}. ` +
        `This flag may need migration to schema v2.`
      );
    }

    const environments = ['development', 'staging', 'production'];
    for (const env of environments) {
      if (!(env in flag.defaultValues)) {
        throw new Error(
          `Flag "${flag.key}" is missing default value for environment "${env}". ` +
          `Current defaultValues: ${JSON.stringify(flag.defaultValues)}. ` +
          `This flag may need migration to schema v2.`
        );
      }
    }

    // Validate flag key per JSON Spec
    const keyValidation = validateIdentifierKey(flag.key);
    if (!keyValidation.valid) {
      throw new Error(`Invalid flag key "${flag.key}": ${keyValidation.error}`);
    }

    // Normalize Prisma enum to lowercase (Prisma returns 'BOOL', we want 'bool')
    const jsonSpecType = normalizeFlagType(flag.type);

    // Start with conditional variants from the flag itself
    const developmentVariants = (flag.variants.development || []).map((variant: any) => ({
      type: 'conditional', // All flag variants are conditional
      order: variant.order || 0,
      value: variant.value,
      conditions: variant.conditions || [] // Always include conditions for flag variants
    }));

    const stagingVariants = (flag.variants.staging || []).map((variant: any) => ({
      type: 'conditional', // All flag variants are conditional
      order: variant.order || 0,
      value: variant.value,
      conditions: variant.conditions || [] // Always include conditions for flag variants
    }));

    const productionVariants = (flag.variants.production || []).map((variant: any) => ({
      type: 'conditional', // All flag variants are conditional
      order: variant.order || 0,
      value: variant.value,
      conditions: variant.conditions || [] // Always include conditions for flag variants
    }));

    flags[flag.key] = {
      type: jsonSpecType,
      description: flag.description || '',
      development: {
        default: flag.defaultValues.development,
        variants: developmentVariants
      },
      staging: {
        default: flag.defaultValues.staging,
        variants: stagingVariants
      },
      production: {
        default: flag.defaultValues.production,
        variants: productionVariants
      }
    };
  });

  // Transform tests and rollouts per JSON Spec
  const tests: Record<string, Test> = {};
  const rollouts: Record<string, Rollout> = {};

  app.testRollouts.forEach((testRollout: any) => {
    // Validate test/rollout key per JSON Spec
    const keyValidation = validateIdentifierKey(testRollout.key);
    if (!keyValidation.valid) {
      throw new Error(`Invalid test/rollout key "${testRollout.key}": ${keyValidation.error}`);
    }

    if (testRollout.type === 'TEST') {
      // JSON Spec compliant test
      tests[testRollout.key] = {
        name: testRollout.name,
        description: testRollout.description,
        type: 'test',
        salt: testRollout.salt,
        conditions: testRollout.conditions || []
      };

      // Add test variants to assigned flags
      const assignedFlagIds = testRollout.flagIds || [];
      assignedFlagIds.forEach((flagId: string) => {
        // Find the flag by ID
        const flag = app.flags.find((f: any) => f.id === flagId);
        if (flag && flags[flag.key]) {
          const variants = testRollout.variants || {};

          // Add test variant to each environment that has variant values
          ['development', 'staging', 'production'].forEach(env => {
            if (variants) {
              // Calculate the highest current order to append test variants after conditional ones
              const currentVariants = flags[flag.key][env].variants;
              const highestOrder = currentVariants.length > 0
                ? Math.max(...currentVariants.map((v: any) => v.order || 0))
                : 0;

              // For tests, we need to create variants based on the test variant definitions
              // Note: Test values are stored per variant but we need flag-specific values
              const testVariantValues: Record<string, any> = {};
              Object.keys(variants).forEach((variantName: string) => {
                const variantData = variants[variantName];
                // The values structure is: { variantName: { percentage, values: { dev: ..., staging: ..., prod: ... } } }
                // But we need to get the flag-specific value for this environment
                if (variantData.values && variantData.values[env] !== null) {
                  // Check if this is the correct flag-specific value structure
                  const flagValue = variantData.values[env];
                  if (typeof flagValue === 'object' && flagValue[flag.id] !== undefined) {
                    // Flag-specific value exists
                    testVariantValues[variantName] = flagValue[flag.id];
                  } else if (typeof flagValue !== 'object') {
                    // Direct value (not flag-specific)
                    testVariantValues[variantName] = flagValue;
                  }
                  // If neither case matches, the test doesn't have values for this flag yet
                }
              });

              // Only add test variant if we have actual values (not null)
              if (Object.keys(testVariantValues).length > 0) {
                flags[flag.key][env].variants.push({
                  type: 'test',
                  order: highestOrder + 10, // Ensure test variants come after conditionals
                  test: testRollout.key,
                  values: testVariantValues
                });
              }
            }
          });
        }
      });

    } else if (testRollout.type === 'ROLLOUT') {
      // JSON Spec compliant rollout
      rollouts[testRollout.key] = {
        name: testRollout.name,
        description: testRollout.description,
        type: 'rollout',
        salt: testRollout.salt,
        conditions: testRollout.conditions || [],
        percentage: testRollout.percentage || 0
      };

      // Add rollout variants to assigned flags
      const assignedFlagIds = testRollout.flagIds || [];
      assignedFlagIds.forEach((flagId: string) => {
        // Find the flag by ID
        const flag = app.flags.find((f: any) => f.id === flagId);
        if (flag && flags[flag.key] && testRollout.rolloutValues) {
          // Add rollout variant to each environment
          ['development', 'staging', 'production'].forEach(env => {
            if (testRollout.rolloutValues && testRollout.rolloutValues[env] !== null && testRollout.rolloutValues[env] !== undefined) {
              // Calculate the highest current order to append rollout variants after others
              const currentVariants = flags[flag.key][env].variants;
              const highestOrder = currentVariants.length > 0
                ? Math.max(...currentVariants.map((v: any) => v.order || 0))
                : 0;

              // Extract the flag-specific rollout value
              const rolloutValue = testRollout.rolloutValues[env];
              let flagSpecificValue;

              if (typeof rolloutValue === 'object' && rolloutValue[flag.id] !== undefined) {
                // Flag-specific value exists
                flagSpecificValue = rolloutValue[flag.id];
              } else if (typeof rolloutValue !== 'object') {
                // Direct value (not flag-specific)
                flagSpecificValue = rolloutValue;
              } else {
                // No value for this flag, skip
                return;
              }

              flags[flag.key][env].variants.push({
                type: 'rollout',
                order: highestOrder + 10, // Ensure rollout variants come after conditionals/tests
                rollout: testRollout.key,
                value: flagSpecificValue
              });
            }
          });
        }
      });
    }
  });

  // Sort all variants by order
  Object.keys(flags).forEach(flagKey => {
    ['development', 'staging', 'production'].forEach(env => {
      flags[flagKey][env].variants.sort((a: any, b: any) => a.order - b.order);
    });
  });

  // Generate the corrected config artifact
  const config: ConfigArtifact = {
    schema_version: 2,
    config_version: '', // Will be set during publishing
    published_at: '', // Will be set during publishing
    app_identifier: app.identifier,
    cohorts,
    flags,
    tests,
    rollouts
  };

  return config;
}

