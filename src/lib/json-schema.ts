/**
 * JSON Schema for validating config artifacts
 * Based on JSON Spec lines 287-414
 */

export const configArtifactSchema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		schema_version: { type: 'integer', const: 1 },
		config_version: { type: 'string' },
		published_at: { type: 'string', format: 'date-time' },
		app_identifier: { type: 'string' },
		flags: {
			type: 'object',
			additionalProperties: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						enum: ['bool', 'string', 'int', 'double', 'date', 'json'],
					},
					description: { type: 'string' },
					development: { $ref: '#/definitions/environment' },
					beta: { $ref: '#/definitions/environment' },
					production: { $ref: '#/definitions/environment' },
				},
				required: ['type', 'development', 'beta', 'production'],
			},
		},
		tests: {
			type: 'object',
			additionalProperties: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					description: { type: 'string' },
					type: { type: 'string', const: 'test' },
					salt: { type: 'string' },
					conditions: {
						type: 'array',
						items: { $ref: '#/definitions/condition' },
					},
				},
				required: ['name', 'type', 'salt'],
			},
		},
		rollouts: {
			type: 'object',
			additionalProperties: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					description: { type: 'string' },
					type: { type: 'string', const: 'rollout' },
					salt: { type: 'string' },
					conditions: {
						type: 'array',
						items: { $ref: '#/definitions/condition' },
					},
					percentage: { type: 'integer', minimum: 0, maximum: 100 },
				},
				required: ['name', 'type', 'salt', 'percentage'],
			},
		},
	},
	required: [
		'schema_version',
		'config_version',
		'published_at',
		'app_identifier',
		'flags',
		'tests',
		'rollouts',
	],
	definitions: {
		environment: {
			type: 'object',
			properties: {
				default: {}, // Any type allowed for default value
				variants: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								enum: ['conditional', 'test', 'rollout'],
							},
							value: {}, // Any type allowed for variant value
							order: { type: 'integer' },
							conditions: {
								type: 'array',
								items: { $ref: '#/definitions/condition' },
							},
							test: { type: 'string' },
							rollout: { type: 'string' },
						},
						required: ['type', 'value', 'order'],
						allOf: [
							{
								if: {
									properties: { type: { const: 'conditional' } },
								},
								then: {
									required: ['conditions'],
								},
							},
							{
								if: {
									properties: { type: { const: 'test' } },
								},
								then: {
									required: ['test'],
								},
							},
							{
								if: {
									properties: { type: { const: 'rollout' } },
								},
								then: {
									required: ['rollout'],
								},
							},
						],
					},
				},
			},
			required: ['default'],
		},
		condition: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					enum: [
						'app_version',
						'os_version',
						'build_number',
						'platform',
						'device_model',
						'region',
						'language',
						'custom_attribute',
					],
				},
				values: {
					type: 'array',
					items: { type: 'string' },
					minItems: 1,
				},
				operator: {
					type: 'string',
					enum: [
						'equals',
						'does_not_equals',
						'between',
						'greater_than_or_equal',
						'greater_than',
						'less_than',
						'less_than_or_equal',
						'in',
						'not_in',
						'custom',
					],
				},
			},
			required: ['type', 'values', 'operator'],
		},
	},
};

// Narrow an unknown value to a plain object for property inspection.
function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: {};
}

/**
 * Validate a config artifact against the JSON Schema
 */
export function validateConfigArtifact(config: unknown): {
	valid: boolean;
	errors: string[];
} {
	// Note: This is a simplified validation
	// In production, you'd use a proper JSON Schema validator like Ajv
	const errors: string[] = [];
	const cfg = asRecord(config);

	// Check required top-level fields
	const requiredFields = [
		'schema_version',
		'config_version',
		'published_at',
		'app_identifier',
		'flags',
		'tests',
		'rollouts',
	];

	for (const field of requiredFields) {
		if (!(field in cfg)) {
			errors.push(`Missing required field: ${field}`);
		}
	}

	// Validate schema version
	if (cfg.schema_version !== 1) {
		errors.push(
			`Invalid schema_version: expected 1, got ${String(cfg.schema_version)}`,
		);
	}

	// Validate config version format (YYYY-MM-DD.N)
	if (
		typeof cfg.config_version === 'string' &&
		!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(cfg.config_version)
	) {
		errors.push(`Invalid config_version format: ${cfg.config_version}`);
	}

	// Validate published_at is ISO 8601
	if (typeof cfg.published_at === 'string') {
		try {
			new Date(cfg.published_at).toISOString();
		} catch {
			errors.push(`Invalid published_at format: ${cfg.published_at}`);
		}
	}

	// Validate flag types
	if (cfg.flags) {
		const validFlagTypes = [
			'bool',
			'string',
			'int',
			'double',
			'date',
			'json',
		];
		for (const [key, flag] of Object.entries(asRecord(cfg.flags))) {
			if (flag && typeof flag === 'object') {
				const f = flag as Record<string, unknown>;
				if (!validFlagTypes.includes(f.type as string)) {
					errors.push(`Invalid flag type for "${key}": ${String(f.type)}`);
				}

				// Check required environments
				const environments = ['development', 'beta', 'production'];
				for (const env of environments) {
					if (!(env in f)) {
						errors.push(`Flag "${key}" missing environment: ${env}`);
					}
				}
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Additional validation for naming rules per JSON Spec
 */
export function validateNamingRules(config: unknown): string[] {
	const errors: string[] = [];
	const keyPattern = /^[a-z_]+$/;
	const noLeadingTrailing = /^[a-z](?:[a-z_]*[a-z])?$/;
	const cfg = asRecord(config);

	// Validate flag keys
	if (cfg.flags) {
		for (const key of Object.keys(asRecord(cfg.flags))) {
			if (!keyPattern.test(key)) {
				errors.push(
					`Flag key "${key}" violates naming rules: must contain only lowercase letters and underscores`,
				);
			} else if (!noLeadingTrailing.test(key)) {
				errors.push(
					`Flag key "${key}" violates naming rules: cannot start or end with underscore`,
				);
			} else if (key.length > 64) {
				errors.push(
					`Flag key "${key}" violates naming rules: cannot exceed 64 characters`,
				);
			}
		}
	}

	// Validate test keys
	if (cfg.tests) {
		for (const key of Object.keys(asRecord(cfg.tests))) {
			if (!keyPattern.test(key)) {
				errors.push(
					`Test key "${key}" violates naming rules: must contain only lowercase letters and underscores`,
				);
			} else if (!noLeadingTrailing.test(key)) {
				errors.push(
					`Test key "${key}" violates naming rules: cannot start or end with underscore`,
				);
			} else if (key.length > 64) {
				errors.push(
					`Test key "${key}" violates naming rules: cannot exceed 64 characters`,
				);
			}
		}
	}

	// Validate rollout keys
	if (cfg.rollouts) {
		for (const key of Object.keys(asRecord(cfg.rollouts))) {
			if (!keyPattern.test(key)) {
				errors.push(
					`Rollout key "${key}" violates naming rules: must contain only lowercase letters and underscores`,
				);
			} else if (!noLeadingTrailing.test(key)) {
				errors.push(
					`Rollout key "${key}" violates naming rules: cannot start or end with underscore`,
				);
			} else if (key.length > 64) {
				errors.push(
					`Rollout key "${key}" violates naming rules: cannot exceed 64 characters`,
				);
			}
		}
	}

	return errors;
}
