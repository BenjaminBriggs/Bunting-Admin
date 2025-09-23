// Utility functions for comparing configurations

export interface ConfigArtifact {
  schema_version: number;
  config_version: string | null;
  published_at: string | null;
  app_identifier: string;
  development?: {
    flags: Record<string, any>;
    cohorts: Record<string, any>;
    test_rollouts?: Record<string, any>;
  };
  staging?: {
    flags: Record<string, any>;
    cohorts: Record<string, any>;
    test_rollouts?: Record<string, any>;
  };
  production?: {
    flags: Record<string, any>;
    cohorts: Record<string, any>;
    test_rollouts?: Record<string, any>;
  };
  // Legacy schema v1 support
  cohorts?: Record<string, any>;
  flags?: Record<string, any>;
  // Current schema v2 support
  tests?: Record<string, any>;
  rollouts?: Record<string, any>;
}

// Helper functions to extract data from both schema versions
function extractFlags(config: ConfigArtifact): Record<string, any> {
  // Check if this is the current schema v2 format (flags with environment sub-objects)
  if (config.flags && typeof config.flags === 'object') {
    const firstFlag = Object.values(config.flags)[0] as any;
    if (firstFlag && typeof firstFlag === 'object' &&
        ('development' in firstFlag || 'staging' in firstFlag || 'production' in firstFlag)) {
      // Current schema v2: flags with environment sub-objects
      return config.flags;
    }
  }

  if (config.development) {
    // Old schema v2: environment-first
    const allFlags: Record<string, any> = {};
    ['development', 'staging', 'production'].forEach(env => {
      const envData = config[env as keyof ConfigArtifact] as any;
      if (envData?.flags) {
        Object.keys(envData.flags).forEach(flagKey => {
          if (!allFlags[flagKey]) allFlags[flagKey] = {};
          allFlags[flagKey][env] = envData.flags[flagKey];
        });
      }
    });
    return allFlags;
  } else {
    // Schema v1: legacy format
    return config.flags || {};
  }
}

function extractCohorts(config: ConfigArtifact): Record<string, any> {
  if (config.development) {
    // Schema v2: cohorts are the same across environments, just take from development
    return config.development.cohorts || {};
  } else {
    // Schema v1: legacy format
    return config.cohorts || {};
  }
}

function extractTestRollouts(config: ConfigArtifact): Record<string, any> {
  if (config.development) {
    // Schema v2: test_rollouts from development (they're the same across envs)
    return config.development.test_rollouts || {};
  } else {
    // Schema v1: no test_rollouts
    return {};
  }
}

function extractTests(config: ConfigArtifact): Record<string, any> {
  // Current schema v2: tests are at top level
  return config.tests || {};
}

function extractRollouts(config: ConfigArtifact): Record<string, any> {
  // Current schema v2: rollouts are at top level
  return config.rollouts || {};
}

// Compare two configs and return whether they are different
export function hasConfigChanges(currentConfig: ConfigArtifact, publishedConfig: ConfigArtifact | null): boolean {
  // If there's no published config, we definitely have changes
  if (!publishedConfig) {
    return true;
  }

  // Compare flags (environment-aware)
  const currentFlags = extractFlags(currentConfig);
  const publishedFlags = extractFlags(publishedConfig);

  if (JSON.stringify(sortObject(currentFlags)) !== JSON.stringify(sortObject(publishedFlags))) {
    return true;
  }

  // Compare cohorts
  const currentCohorts = extractCohorts(currentConfig);
  const publishedCohorts = extractCohorts(publishedConfig);

  if (JSON.stringify(sortObject(currentCohorts)) !== JSON.stringify(sortObject(publishedCohorts))) {
    return true;
  }

  // Compare tests
  const currentTests = extractTests(currentConfig);
  const publishedTests = extractTests(publishedConfig);

  if (JSON.stringify(sortObject(currentTests)) !== JSON.stringify(sortObject(publishedTests))) {
    return true;
  }

  // Compare rollouts
  const currentRollouts = extractRollouts(currentConfig);
  const publishedRollouts = extractRollouts(publishedConfig);

  if (JSON.stringify(sortObject(currentRollouts)) !== JSON.stringify(sortObject(publishedRollouts))) {
    return true;
  }

  // App identifier should match
  if (currentConfig.app_identifier !== publishedConfig.app_identifier) {
    return true;
  }

  return false;
}

// Get detailed changes between configs
export interface ConfigChange {
  type: 'flag' | 'cohort' | 'test' | 'rollout';
  action: 'added' | 'modified' | 'removed';
  key: string;
  name: string;
  details?: string[];
}

export function getConfigChanges(currentConfig: ConfigArtifact, publishedConfig: ConfigArtifact | null): ConfigChange[] {
  const changes: ConfigChange[] = [];

  if (!publishedConfig) {
    // All current items are "added"
    const currentFlags = extractFlags(currentConfig);
    const currentCohorts = extractCohorts(currentConfig);
    const currentTestRollouts = extractTestRollouts(currentConfig);

    Object.keys(currentFlags).forEach(key => {
      changes.push({
        type: 'flag',
        action: 'added',
        key,
        name: `Flag: ${key}`
      });
    });

    Object.keys(currentCohorts).forEach(key => {
      changes.push({
        type: 'cohort',
        action: 'added',
        key,
        name: `Cohort: ${currentCohorts[key].name || key}`
      });
    });

    return changes;
  }

  // Compare flags
  const currentFlags = extractFlags(currentConfig);
  const publishedFlags = extractFlags(publishedConfig);

  // Check for added/modified flags
  Object.keys(currentFlags).forEach(key => {
    if (!publishedFlags[key]) {
      changes.push({
        type: 'flag',
        action: 'added',
        key,
        name: `Flag: ${key}`
      });
    } else if (JSON.stringify(currentFlags[key]) !== JSON.stringify(publishedFlags[key])) {
      const details = getObjectDifferences(currentFlags[key], publishedFlags[key]);
      changes.push({
        type: 'flag',
        action: 'modified',
        key,
        name: `Flag: ${key}`,
        details
      });
    }
  });

  // Check for removed flags
  Object.keys(publishedFlags).forEach(key => {
    if (!currentFlags[key]) {
      changes.push({
        type: 'flag',
        action: 'removed',
        key,
        name: `Flag: ${key}`
      });
    }
  });

  // Compare cohorts
  const currentCohorts = extractCohorts(currentConfig);
  const publishedCohorts = extractCohorts(publishedConfig);

  // Check for added/modified cohorts
  Object.keys(currentCohorts).forEach(key => {
    if (!publishedCohorts[key]) {
      changes.push({
        type: 'cohort',
        action: 'added',
        key,
        name: `Cohort: ${currentCohorts[key].name || key}`
      });
    } else if (JSON.stringify(currentCohorts[key]) !== JSON.stringify(publishedCohorts[key])) {
      const details = getObjectDifferences(currentCohorts[key], publishedCohorts[key]);
      changes.push({
        type: 'cohort',
        action: 'modified',
        key,
        name: `Cohort: ${currentCohorts[key].name || key}`,
        details
      });
    }
  });

  // Check for removed cohorts
  Object.keys(publishedCohorts).forEach(key => {
    if (!currentCohorts[key]) {
      changes.push({
        type: 'cohort',
        action: 'removed',
        key,
        name: `Cohort: ${publishedCohorts[key].name || key}`
      });
    }
  });

  // Compare tests
  const currentTests = extractTests(currentConfig);
  const publishedTests = extractTests(publishedConfig);

  // Check for added/modified tests
  Object.keys(currentTests).forEach(key => {
    if (!publishedTests[key]) {
      changes.push({
        type: 'test',
        action: 'added',
        key,
        name: `Test: ${currentTests[key].name || key}`
      });
    } else if (JSON.stringify(currentTests[key]) !== JSON.stringify(publishedTests[key])) {
      const details = getObjectDifferences(currentTests[key], publishedTests[key]);
      changes.push({
        type: 'test',
        action: 'modified',
        key,
        name: `Test: ${currentTests[key].name || key}`,
        details
      });
    }
  });

  // Check for removed tests
  Object.keys(publishedTests).forEach(key => {
    if (!currentTests[key]) {
      changes.push({
        type: 'test',
        action: 'removed',
        key,
        name: `Test: ${publishedTests[key].name || key}`
      });
    }
  });

  // Compare rollouts
  const currentRollouts = extractRollouts(currentConfig);
  const publishedRollouts = extractRollouts(publishedConfig);

  // Check for added/modified rollouts
  Object.keys(currentRollouts).forEach(key => {
    if (!publishedRollouts[key]) {
      changes.push({
        type: 'rollout',
        action: 'added',
        key,
        name: `Rollout: ${currentRollouts[key].name || key}`
      });
    } else if (JSON.stringify(currentRollouts[key]) !== JSON.stringify(publishedRollouts[key])) {
      const details = getObjectDifferences(currentRollouts[key], publishedRollouts[key]);
      changes.push({
        type: 'rollout',
        action: 'modified',
        key,
        name: `Rollout: ${currentRollouts[key].name || key}`,
        details
      });
    }
  });

  // Check for removed rollouts
  Object.keys(publishedRollouts).forEach(key => {
    if (!currentRollouts[key]) {
      changes.push({
        type: 'rollout',
        action: 'removed',
        key,
        name: `Rollout: ${publishedRollouts[key].name || key}`
      });
    }
  });

  return changes;
}

// Helper function to sort object keys for consistent comparison
function sortObject(obj: Record<string, any>): Record<string, any> {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {} as Record<string, any>);
}

// Helper function to get differences between two objects
function getObjectDifferences(current: any, published: any): string[] {
  const differences: string[] = [];

  // Simple implementation - just check top-level properties
  const allKeys = new Set([...Object.keys(current), ...Object.keys(published)]);
  
  allKeys.forEach(key => {
    if (current[key] !== published[key]) {
      if (current[key] === undefined) {
        differences.push(`Removed: ${key}`);
      } else if (published[key] === undefined) {
        differences.push(`Added: ${key}`);
      } else {
        differences.push(`Changed: ${key} (${JSON.stringify(published[key])} → ${JSON.stringify(current[key])})`);
      }
    }
  });

  return differences;
}