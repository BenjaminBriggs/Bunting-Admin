/**
 * Config Validation Utilities
 *
 * Extracted from API route to make validation logic testable without database.
 * This addresses the issue where invalid flag types like "boolean" weren't caught.
 */

import type { FlagValue } from '@/types';

export interface ValidationResult {
	errors: ValidationError[];
	warnings: ValidationWarning[];
}

export interface ValidationError {
	type: string;
	message: string;
	flagKey?: string;
}

export interface ValidationWarning {
	type: string;
	message: string;
	flagKey?: string;
}

const VALID_FLAG_TYPES = [
	'bool',
	'string',
	'int',
	'double',
	'date',
	'json',
] as const;
const ENVIRONMENTS = ['development', 'beta', 'production'] as const;

export type ValidFlagType = (typeof VALID_FLAG_TYPES)[number];
export type Environment = (typeof ENVIRONMENTS)[number];

// Narrow an unknown value to a plain object for property inspection.
function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: {};
}

/**
 * Validates a complete configuration object for errors and warnings.
 * This is the core validation logic that should catch type mismatches.
 */
export function validateConfig(config: unknown): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	// Validate flags
	Object.entries(asRecord(asRecord(config).flags)).forEach(([key, raw]) => {
		const flag = asRecord(raw);
		// Check for environment-specific default values (schema v2)
		ENVIRONMENTS.forEach((env) => {
			const envCfg = asRecord(flag[env]);
			if (envCfg.default === undefined || envCfg.default === null) {
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
				message: `Flag "${key}" has invalid type "${String(flag.type)}"`,
				flagKey: key,
			});
		}

		// Validate JSON flags for all environments
		if (flag.type === 'json') {
			ENVIRONMENTS.forEach((env) => {
				const envDefault = asRecord(flag[env]).default;
				if (typeof envDefault === 'string') {
					try {
						JSON.parse(envDefault);
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
	});

	return { errors, warnings };
}

/**
 * Type guard to check if a string is a valid flag type.
 * This prevents bugs like "boolean" vs "bool".
 */
export function isValidFlagType(type: unknown): type is ValidFlagType {
	return (
		typeof type === 'string' && VALID_FLAG_TYPES.includes(type as ValidFlagType)
	);
}

/**
 * Validates a single flag's type and structure.
 */
export function validateFlag(flag: unknown): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	const type = asRecord(flag).type;
	if (!isValidFlagType(type)) {
		errors.push({
			type: 'invalid_type',
			message: `Invalid flag type "${String(type)}". Must be one of: ${VALID_FLAG_TYPES.join(', ')}`,
		});
	}

	return { errors, warnings };
}

/**
 * Validates that a flag value matches its declared type.
 */
export function validateFlagValue(type: ValidFlagType, value: unknown): boolean {
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
 * Normalizes Prisma enum values to the JSON wire form the SDK decodes.
 * Prisma returns "BOOL" but the wire form is "bool".
 */
export function normalizeFlagType(type: string): string {
	const typeMap: Record<string, string> = {
		BOOL: 'bool',
		STRING: 'string',
		INT: 'int',
		DOUBLE: 'double',
		DATE: 'date',
		JSON: 'json',
	};

	return typeMap[type.toUpperCase()] || type.toLowerCase();
}

/**
 * Generates appropriate default values for testing.
 */
export function getDefaultValueForType(type: ValidFlagType): FlagValue {
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
	}
}
