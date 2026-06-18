/**
 * JSON Spec compliant validation rules
 * Based on naming rules from JSON Spec lines 416-430
 */

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validate identifier keys for flags, tests, and rollouts
 *
 * JSON Spec Requirements:
 * - Pattern: ^[a-z_]+$
 * - No leading or trailing underscores (recommended)
 * - Max length: 64 characters
 */
export function validateIdentifierKey(key: string): ValidationResult {
	if (!key) {
		return { valid: false, error: 'Key cannot be empty' };
	}

	// Must start with a lowercase letter, then lowercase letters / digits / underscores,
	// with optional `/`-separated namespace segments (each segment starting with a letter).
	// Keep this in sync with validateKey() in lib/utils.ts — input and publish validation
	// must agree, or a key can be created that later fails config generation.
	if (!/^[a-z][a-z0-9_]*(?:\/[a-z][a-z0-9_]*)*$/.test(key)) {
		return {
			valid: false,
			error:
				'Key must start with a lowercase letter and contain only lowercase letters, numbers, underscores, and forward slashes',
		};
	}

	// Check no trailing underscore (recommended by JSON Spec)
	if (key.endsWith('_')) {
		return {
			valid: false,
			error: 'Key cannot end with underscore',
		};
	}

	// Check max length
	if (key.length > 64) {
		return {
			valid: false,
			error: 'Key cannot exceed 64 characters',
		};
	}

	// Check minimum length (reasonable minimum)
	if (key.length < 2) {
		return {
			valid: false,
			error: 'Key must be at least 2 characters long',
		};
	}

	return { valid: true };
}

/**
 * Normalize user input to valid identifier key
 * Converts "Store: Use New Paywall Design" -> "store_use_new_paywall_design"
 */
export function normalizeToIdentifierKey(input: string): string {
	return (
		input
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
			.substring(0, 64)
	);
}

/**
 * Generate display name from identifier key
 * Converts "store_use_new_paywall" -> "Store Use New Paywall"
 */
export function generateDisplayName(key: string): string {
	return key
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * Validate app identifier
 * Should be a reverse domain notation or similar unique identifier
 */
export function validateAppIdentifier(identifier: string): ValidationResult {
	if (!identifier) {
		return { valid: false, error: 'App identifier cannot be empty' };
	}

	// Allow reverse domain notation: com.example.app
	if (!/^[a-z0-9._-]+$/.test(identifier)) {
		return {
			valid: false,
			error:
				'App identifier must contain only lowercase letters, numbers, dots, underscores, and hyphens',
		};
	}

	if (identifier.length > 128) {
		return {
			valid: false,
			error: 'App identifier cannot exceed 128 characters',
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
		return { valid: false, error: 'Config version cannot be empty' };
	}

	// Pattern: YYYY-MM-DD.N
	const pattern = /^\d{4}-\d{2}-\d{2}\.\d+$/;
	if (!pattern.test(version)) {
		return {
			valid: false,
			error:
				'Config version must follow YYYY-MM-DD.N format (e.g., 2025-09-23.1)',
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
		.filter((v) => v.startsWith(datePrefix))
		.map((v) => {
			const parts = v.split('.');
			return parts.length > 1 ? parseInt(parts[1], 10) : 0;
		})
		.filter((n) => !isNaN(n));

	const nextSequence =
		todayVersions.length > 0 ? Math.max(...todayVersions) + 1 : 1;

	return `${datePrefix}.${nextSequence}`;
}
