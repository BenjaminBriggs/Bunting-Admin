import { prisma } from '@/lib/db';

export interface ConfigArtifact {
  schema_version: number;
  config_version: string | null;
  published_at: string | null;
  app_identifier: string;
  cohorts: Record<string, any>;
  flags: Record<string, any>;
}

export async function generateConfigFromDb(appId: string): Promise<ConfigArtifact> {
  // Get app info
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: {
      flags: {
        where: { archived: false },
        orderBy: { key: 'asc' }
      },
      cohorts: {
        orderBy: { key: 'asc' }
      }
    }
  });

  if (!app) {
    throw new Error('App not found');
  }

  // Transform flags to the config format
  const flags: Record<string, any> = {};
  app.flags.forEach(flag => {
    flags[flag.key] = {
      type: flag.type.toLowerCase(),
      default: flag.defaultValue,
      description: flag.description || '',
      rules: flag.rules || []
    };
  });

  // Transform cohorts to the config format
  const cohorts: Record<string, any> = {};
  app.cohorts.forEach(cohort => {
    cohorts[cohort.key] = {
      name: cohort.name,
      percentage: cohort.percentage,
      salt: cohort.salt,
      description: cohort.description || '',
      rules: cohort.rules || []
    };
  });

  // Generate the config artifact
  const config = {
    schema_version: 1,
    config_version: null, // Will be set during publishing
    published_at: null, // Will be set during publishing
    app_identifier: app.identifier,
    cohorts,
    flags
  };

  return config;
}