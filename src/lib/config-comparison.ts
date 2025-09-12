// Utility functions for comparing configurations

export interface ConfigArtifact {
  schema_version: number;
  config_version: string | null;
  published_at: string | null;
  app_identifier: string;
  cohorts: Record<string, any>;
  flags: Record<string, any>;
}

// Compare two configs and return whether they are different
export function hasConfigChanges(currentConfig: ConfigArtifact, publishedConfig: ConfigArtifact | null): boolean {
  // If there's no published config, we definitely have changes
  if (!publishedConfig) {
    return true;
  }

  // Compare flags (exclude metadata fields)
  const currentFlags = currentConfig.flags;
  const publishedFlags = publishedConfig.flags;

  if (JSON.stringify(sortObject(currentFlags)) !== JSON.stringify(sortObject(publishedFlags))) {
    return true;
  }

  // Compare cohorts (exclude metadata fields)
  const currentCohorts = currentConfig.cohorts;
  const publishedCohorts = publishedConfig.cohorts;

  if (JSON.stringify(sortObject(currentCohorts)) !== JSON.stringify(sortObject(publishedCohorts))) {
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
  type: 'flag' | 'cohort';
  action: 'added' | 'modified' | 'removed';
  key: string;
  name: string;
  details?: string[];
}

export function getConfigChanges(currentConfig: ConfigArtifact, publishedConfig: ConfigArtifact | null): ConfigChange[] {
  const changes: ConfigChange[] = [];

  if (!publishedConfig) {
    // All current items are "added"
    Object.keys(currentConfig.flags).forEach(key => {
      changes.push({
        type: 'flag',
        action: 'added',
        key,
        name: `Flag: ${key}`
      });
    });

    Object.keys(currentConfig.cohorts).forEach(key => {
      changes.push({
        type: 'cohort',
        action: 'added',
        key,
        name: `Cohort: ${currentConfig.cohorts[key].name || key}`
      });
    });

    return changes;
  }

  // Compare flags
  const currentFlags = currentConfig.flags;
  const publishedFlags = publishedConfig.flags;

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
  const currentCohorts = currentConfig.cohorts;
  const publishedCohorts = publishedConfig.cohorts;

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