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

    flags[flag.key] = {
      type: jsonSpecType,
      description: flag.description || '',
      development: {
        default: flag.defaultValues.development,
        variants: (flag.variants.development || []).map((variant: any) => ({
          type: variant.type || 'conditional',
          order: variant.order || 0,
          value: variant.value,
          ...(variant.type === 'conditional' && { conditions: variant.conditions || [] }),
          ...(variant.type === 'test' && { test: variant.test }),
          ...(variant.type === 'rollout' && { rollout: variant.rollout })
        })).sort((a: any, b: any) => a.order - b.order)
      },
      staging: {
        default: flag.defaultValues.staging,
        variants: (flag.variants.staging || []).map((variant: any) => ({
          type: variant.type || 'conditional',
          order: variant.order || 0,
          value: variant.value,
          ...(variant.type === 'conditional' && { conditions: variant.conditions || [] }),
          ...(variant.type === 'test' && { test: variant.test }),
          ...(variant.type === 'rollout' && { rollout: variant.rollout })
        })).sort((a: any, b: any) => a.order - b.order)
      },
      production: {
        default: flag.defaultValues.production,
        variants: (flag.variants.production || []).map((variant: any) => ({
          type: variant.type || 'conditional',
          order: variant.order || 0,
          value: variant.value,
          ...(variant.type === 'conditional' && { conditions: variant.conditions || [] }),
          ...(variant.type === 'test' && { test: variant.test }),
          ...(variant.type === 'rollout' && { rollout: variant.rollout })
        })).sort((a: any, b: any) => a.order - b.order)
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
    }
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

