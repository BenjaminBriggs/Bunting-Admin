/**
 * Config Validation Utilities
 *
 * Extracted from API route to make validation logic testable without database.
 * This addresses the issue where invalid flag types like "boolean" weren't caught.
 */

const VALID_FLAG_TYPES = ['bool', 'string', 'int', 'double', 'date', 'json'];
const ENVIRONMENTS = ['development', 'beta', 'production'];

/**
 * Validates a complete configuration object for errors and warnings.
 * This is the core validation logic that should catch type mismatches.
 */
function validateConfig(config) {
	const errors = [];
	const warnings = [];

	// Validate flags
	Object.entries(config.flags || {}).forEach(([key, flag]) => {
		// Check for environment-specific default values (schema v2)
		ENVIRONMENTS.forEach((env) => {
			if (
				!flag[env] ||
				flag[env].default === undefined ||
				flag[env].default === null
			) {
				errors.push({
					type: 'missing_default',
					message: `Flag "${key}" is missing a default value for environment "${env}"`,
					flagKey: key,
				});
			}
		});

		// Check for valid type - THIS IS CRITICAL FOR CATCHING TYPE BUGS
		if (!isValidFlagType(flag.type)) {
			errors.push({
				type: 'invalid_type',
				message: `Flag "${key}" has invalid type "${flag.type}"`,
				flagKey: key,
			});
		}

		// Validate JSON flags for all environments
		if (flag.type === 'json') {
			ENVIRONMENTS.forEach((env) => {
				if (flag[env] && typeof flag[env].default === 'string') {
					try {
						JSON.parse(flag[env].default);
					} catch {
						errors.push({
							type: 'invalid_json',
							message: `Flag "${key}" has invalid JSON default value for environment "${env}"`,
							flagKey: key,
						});
					}
				}
			});
		}

		// Check variants and their conditions for each environment
		ENVIRONMENTS.forEach((env) => {
			if (
				flag[env] &&
				flag[env].variants &&
				Array.isArray(flag[env].variants)
			) {
				flag[env].variants.forEach((variant, variantIndex) => {
					// Check for valid conditions
					if (
						!variant.conditions ||
						!Array.isArray(variant.conditions) ||
						variant.conditions.length === 0
					) {
						warnings.push({
							type: 'empty_variant',
							message: `Variant ${variantIndex + 1} in flag "${key}" (${env}) has no conditions`,
							flagKey: key,
						});
					}
				});
			}
		});
	});

	return { errors, warnings };
}

/**
 * Type guard to check if a string is a valid flag type.
 * This prevents bugs like "boolean" vs "bool".
 */
function isValidFlagType(type) {
	return typeof type === 'string' && VALID_FLAG_TYPES.includes(type);
}

/**
 * Validates a single flag's type and structure.
 */
function validateFlag(flag) {
	const errors = [];
	const warnings = [];

	if (!isValidFlagType(flag.type)) {
		errors.push({
			type: 'invalid_type',
			message: `Invalid flag type "${flag.type}". Must be one of: ${VALID_FLAG_TYPES.join(', ')}`,
		});
	}

	return { errors, warnings };
}

/**
 * Validates that a flag value matches its declared type.
 */
function validateFlagValue(type, value) {
	switch (type) {
		case 'bool':
			return typeof value === 'boolean';
		case 'string':
			return typeof value === 'string';
		case 'int':
			return Number.isInteger(value);
		case 'double':
			return typeof value === 'number' && !Number.isNaN(value);
		case 'date':
			return typeof value === 'string' && !isNaN(Date.parse(value));
		case 'json':
			if (typeof value !== 'string') {
				return false;
			}
			try {
				JSON.parse(value);
				return true;
			} catch {
				return false;
			}
		default:
			return false;
	}
}

/**
 * Normalizes Prisma enum values to lowercase for consistency.
 * Prisma returns "BOOL" but our validation expects "bool".
 */
function normalizeFlagType(type) {
	return type.toLowerCase();
}

/**
 * Generates appropriate default values for testing.
 */
function getDefaultValueForType(type) {
	switch (type) {
		case 'bool':
			return false;
		case 'string':
			return '';
		case 'int':
			return 0;
		case 'double':
			return 0.0;
		case 'date':
			return new Date().toISOString();
		case 'json':
			return '{}';
		default:
			return null;
	}
}

module.exports = {
	validateConfig,
	isValidFlagType,
	validateFlag,
	validateFlagValue,
	normalizeFlagType,
	getDefaultValueForType,
	VALID_FLAG_TYPES,
	ENVIRONMENTS,
};
