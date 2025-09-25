/**
 * JSON Spec compliant validation rules
 * Based on naming rules from JSON Spec lines 416-430
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate identifier keys for flags, tests, rollouts, and cohorts
 *
 * JSON Spec Requirements:
 * - Pattern: ^[a-z_]+$
 * - No leading or trailing underscores (recommended)
 * - Max length: 64 characters
 */
export function validateIdentifierKey(key: string): ValidationResult {
  if (!key) {
    return { valid: false, error: "Key cannot be empty" };
  }

  // Check basic pattern: lowercase letters and underscores only
  if (!/^[a-z_]+$/.test(key)) {
    return {
      valid: false,
      error: "Key must contain only lowercase letters (a-z) and underscores"
    };
  }

  // Check no leading underscore (recommended by JSON Spec)
  if (key.startsWith('_')) {
    return {
      valid: false,
      error: "Key cannot start with underscore"
    };
  }

  // Check no trailing underscore (recommended by JSON Spec)
  if (key.endsWith('_')) {
    return {
      valid: false,
      error: "Key cannot end with underscore"
    };
  }

  // Check max length
  if (key.length > 64) {
    return {
      valid: false,
      error: "Key cannot exceed 64 characters"
    };
  }

  // Check minimum length (reasonable minimum)
  if (key.length < 2) {
    return {
      valid: false,
      error: "Key must be at least 2 characters long"
    };
  }

  return { valid: true };
}

/**
 * Normalize user input to valid identifier key
 * Converts "Store: Use New Paywall Design" -> "store_use_new_paywall_design"
 */
export function normalizeToIdentifierKey(input: string): string {
  return input
    .toLowerCase()
    // Replace any non-letter with underscore
    .replace(/[^a-z]/g, '_')
    // Collapse multiple underscores
    .replace(/_+/g, '_')
    // Remove leading underscores
    .replace(/^_+/, '')
    // Remove trailing underscores
    .replace(/_+$/, '')
    // Truncate to max length
    .substring(0, 64);
}

/**
 * Generate display name from identifier key
 * Converts "store_use_new_paywall" -> "Store Use New Paywall"
 */
export function generateDisplayName(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Validate condition ID
 * Condition IDs should be descriptive but follow similar rules
 */
export function validateConditionId(id: string): ValidationResult {
  if (!id) {
    return { valid: false, error: "Condition ID cannot be empty" };
  }

  // More lenient pattern for condition IDs - allow hyphens
  if (!/^[a-z0-9_-]+$/.test(id)) {
    return {
      valid: false,
      error: "Condition ID must contain only lowercase letters, numbers, underscores, and hyphens"
    };
  }

  if (id.length > 64) {
    return {
      valid: false,
      error: "Condition ID cannot exceed 64 characters"
    };
  }

  return { valid: true };
}

/**
 * Generate a descriptive condition ID
 * Examples: "osv-gte-14", "region-eu", "custom-check-1"
 */
export function generateConditionId(type: string, operator: string, values: string[]): string {
  const typeAbbrev = type.replace('_', '').substring(0, 6);
  const opAbbrev = operator.replace('_', '-').substring(0, 8);
  const valueAbbrev = values.length > 0 ? values[0].replace(/[^a-z0-9]/gi, '').substring(0, 8) : '';

  const id = [typeAbbrev, opAbbrev, valueAbbrev]
    .filter(Boolean)
    .join('-')
    .toLowerCase();

  return id.substring(0, 64);
}

/**
 * Validate app identifier
 * Should be a reverse domain notation or similar unique identifier
 */
export function validateAppIdentifier(identifier: string): ValidationResult {
  if (!identifier) {
    return { valid: false, error: "App identifier cannot be empty" };
  }

  // Allow reverse domain notation: com.example.app
  if (!/^[a-z0-9._-]+$/.test(identifier)) {
    return {
      valid: false,
      error: "App identifier must contain only lowercase letters, numbers, dots, underscores, and hyphens"
    };
  }

  if (identifier.length > 128) {
    return {
      valid: false,
      error: "App identifier cannot exceed 128 characters"
    };
  }

  return { valid: true };
}

/**
 * Validate configuration version format
 * Should follow YYYY-MM-DD.N pattern
 */
export function validateConfigVersion(version: string): ValidationResult {
  if (!version) {
    return { valid: false, error: "Config version cannot be empty" };
  }

  // Pattern: YYYY-MM-DD.N
  const pattern = /^\d{4}-\d{2}-\d{2}\.\d+$/;
  if (!pattern.test(version)) {
    return {
      valid: false,
      error: "Config version must follow YYYY-MM-DD.N format (e.g., 2025-09-23.1)"
    };
  }

  return { valid: true };
}

/**
 * Generate next config version for today
 */
export function generateConfigVersion(existingVersions: string[] = []): string {
  const today = new Date();
  const datePrefix = today.toISOString().split('T')[0]; // YYYY-MM-DD

  // Find highest sequence number for today
  const todayVersions = existingVersions
    .filter(v => v.startsWith(datePrefix))
    .map(v => {
      const parts = v.split('.');
      return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    })
    .filter(n => !isNaN(n));

  const nextSequence = todayVersions.length > 0 ? Math.max(...todayVersions) + 1 : 1;

  return `${datePrefix}.${nextSequence}`;
}