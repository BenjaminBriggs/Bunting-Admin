import { prisma } from '@/lib/db';
import { ConfigArtifact, EnvironmentConfig, Environment } from '@/types';

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

  const environments: Environment[] = ['development', 'staging', 'production'];
  
  // Generate environment configs
  const envConfigs: Record<Environment, EnvironmentConfig> = {
    development: generateEnvironmentConfig(app, 'development'),
    staging: generateEnvironmentConfig(app, 'staging'), 
    production: generateEnvironmentConfig(app, 'production')
  };

  // Generate the new environment-first config artifact
  const config: ConfigArtifact = {
    schema_version: 2,
    config_version: null, // Will be set during publishing
    published_at: null, // Will be set during publishing
    app_identifier: app.identifier,
    development: envConfigs.development,
    staging: envConfigs.staging,
    production: envConfigs.production
  };

  return config;
}

function generateEnvironmentConfig(app: any, environment: Environment): EnvironmentConfig {
  // Transform flags for this environment
  const flags: Record<string, any> = {};
  app.flags.forEach((flag: any) => {
    const flagConfig = {
      type: flag.type.toLowerCase(),
      default: flag.defaultValues[environment],
      description: flag.description || ''
    };

    // Add conditional variants for this environment
    const envVariants = flag.variants[environment] || [];
    if (envVariants.length > 0) {
      flagConfig.variants = envVariants.map((variant: any) => ({
        id: variant.id,
        name: variant.name,
        type: variant.type || 'conditional',
        value: variant.value,
        conditions: variant.conditions || [],
        order: variant.order || 0
      })).sort((a: any, b: any) => a.order - b.order);
    }

    flags[flag.key] = flagConfig;
  });

  // Transform cohorts (same for all environments, just condition groups)
  const cohorts: Record<string, any> = {};
  app.cohorts.forEach((cohort: any) => {
    cohorts[cohort.key] = {
      name: cohort.name,
      description: cohort.description || '',
      conditions: cohort.conditions || []
    };
  });

  // Transform test/rollouts for this environment
  const testRollouts: Record<string, any> = {};
  app.testRollouts.forEach((testRollout: any) => {
    const trConfig = {
      name: testRollout.name,
      description: testRollout.description || '',
      type: testRollout.type.toLowerCase(),
      salt: testRollout.salt,
      conditions: testRollout.conditions || []
    };

    if (testRollout.type === 'TEST' && testRollout.variants) {
      // Test with variants
      trConfig.variants = {};
      Object.entries(testRollout.variants).forEach(([variantName, variant]: [string, any]) => {
        trConfig.variants[variantName] = {
          percentage: variant.percentage,
          value: variant.values[environment]
        };
      });
    } else if (testRollout.type === 'ROLLOUT') {
      // Simple rollout
      trConfig.percentage = testRollout.percentage;
      trConfig.value = testRollout.rolloutValues?.[environment];
    }

    testRollouts[testRollout.key] = trConfig;
  });

  return {
    flags,
    cohorts,
    test_rollouts: testRollouts
  };
}