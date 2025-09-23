import { prisma } from '@/lib/db';
import { ConfigArtifact, Environment } from '@/types';

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

    flags[flag.key] = {
      type: flag.type.toLowerCase(),
      description: flag.description || '',
      development: {
        default: flag.defaultValues.development,
        variants: (flag.variants.development || []).map((variant: any) => ({
          id: variant.id,
          name: variant.name,
          type: variant.type || 'conditional',
          value: variant.value,
          conditions: variant.conditions || [],
          order: variant.order || 0
        })).sort((a: any, b: any) => a.order - b.order)
      },
      staging: {
        default: flag.defaultValues.staging,
        variants: (flag.variants.staging || []).map((variant: any) => ({
          id: variant.id,
          name: variant.name,
          type: variant.type || 'conditional',
          value: variant.value,
          conditions: variant.conditions || [],
          order: variant.order || 0
        })).sort((a: any, b: any) => a.order - b.order)
      },
      production: {
        default: flag.defaultValues.production,
        variants: (flag.variants.production || []).map((variant: any) => ({
          id: variant.id,
          name: variant.name,
          type: variant.type || 'conditional',
          value: variant.value,
          conditions: variant.conditions || [],
          order: variant.order || 0
        })).sort((a: any, b: any) => a.order - b.order)
      }
    };
  });

  // Transform tests and rollouts (top-level)
  const tests: Record<string, any> = {};
  const rollouts: Record<string, any> = {};
  
  app.testRollouts.forEach((testRollout: any) => {
    const baseConfig = {
      name: testRollout.name,
      description: testRollout.description || '',
      type: testRollout.type.toLowerCase(),
      salt: testRollout.salt,
      conditions: testRollout.conditions || []
    };

    if (testRollout.type === 'TEST' && testRollout.variants) {
      // Test with variants
      tests[testRollout.key] = {
        ...baseConfig,
        variants: testRollout.variants
      };
    } else if (testRollout.type === 'ROLLOUT') {
      // Simple rollout
      rollouts[testRollout.key] = {
        ...baseConfig,
        percentage: testRollout.percentage,
        values: testRollout.rolloutValues
      };
    }
  });

  // Generate the corrected config artifact
  const config: ConfigArtifact = {
    schema_version: 2,
    config_version: null, // Will be set during publishing
    published_at: null, // Will be set during publishing
    app_identifier: app.identifier,
    cohorts,
    flags,
    tests,
    rollouts
  };

  return config;
}

