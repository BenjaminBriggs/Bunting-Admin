/**
 * Input validation middleware for API endpoints
 */

/**
 * Validate flag key format
 */
export function validateFlagKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Flag key is required and must be a string' };
  }

  if (key.length < 1 || key.length > 100) {
    return { valid: false, error: 'Flag key must be between 1 and 100 characters' };
  }

  // Must match /^[a-z0-9_/]+$/ pattern
  if (!/^[a-z0-9_/]+$/.test(key)) {
    return { valid: false, error: 'Flag key must contain only lowercase letters, numbers, underscores, and forward slashes' };
  }

  // Cannot start with number or underscore
  if (/^[0-9_]/.test(key)) {
    return { valid: false, error: 'Flag key cannot start with a number or underscore' };
  }

  // Cannot have trailing underscore or slash
  if (key.endsWith('_') || key.endsWith('/')) {
    return { valid: false, error: 'Flag key cannot end with underscore or slash' };
  }

  // Cannot have double slashes
  if (key.includes('//')) {
    return { valid: false, error: 'Flag key cannot contain consecutive slashes' };
  }

  // Cannot start with slash
  if (key.startsWith('/')) {
    return { valid: false, error: 'Flag key cannot start with slash' };
  }

  return { valid: true };
}

/**
 * Validate flag type
 */
export function validateFlagType(type) {
  const validTypes = ['bool', 'string', 'int', 'double', 'date', 'json'];

  if (!type || typeof type !== 'string') {
    return { valid: false, error: 'Flag type is required and must be a string' };
  }

  const normalizedType = type.toLowerCase();
  if (!validTypes.includes(normalizedType)) {
    return { valid: false, error: `Invalid flag type. Must be one of: ${validTypes.join(', ')}` };
  }

  return { valid: true, normalizedType };
}

/**
 * Validate flag value matches type
 */
export function validateFlagValue(type, value) {
  if (value === undefined || value === null) {
    return { valid: false, error: 'Flag value is required' };
  }

  switch (type.toLowerCase()) {
    case 'bool':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Boolean flag must have boolean value' };
      }
      break;

    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: 'String flag must have string value' };
      }
      break;

    case 'int':
      if (!Number.isInteger(value)) {
        return { valid: false, error: 'Int flag must have integer value' };
      }
      if (value < -2147483648 || value > 2147483647) {
        return { valid: false, error: 'Int value must be within 32-bit integer range' };
      }
      break;

    case 'double':
      if (typeof value !== 'number' || !isFinite(value)) {
        return { valid: false, error: 'Double flag must have finite number value' };
      }
      break;

    case 'date':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Date flag must have ISO8601 string value' };
      }
      const date = new Date(value);
      if (date.toString() === 'Invalid Date' || date.toISOString() !== value) {
        return { valid: false, error: 'Date value must be valid ISO8601 string' };
      }
      break;

    case 'json':
      if (typeof value !== 'string') {
        return { valid: false, error: 'JSON flag must have string value' };
      }
      try {
        JSON.parse(value);
      } catch (error) {
        return { valid: false, error: 'JSON flag value must be valid JSON string' };
      }
      break;

    default:
      return { valid: false, error: `Unknown flag type: ${type}` };
  }

  return { valid: true };
}

/**
 * Validate environment-specific default values
 */
export function validateDefaultValues(type, defaultValues) {
  if (!defaultValues || typeof defaultValues !== 'object') {
    return { valid: false, error: 'defaultValues must be an object' };
  }

  const requiredEnvironments = ['development', 'staging', 'production'];
  const missingEnvs = requiredEnvironments.filter(env => !(env in defaultValues));

  if (missingEnvs.length > 0) {
    return { valid: false, error: `Missing default values for environments: ${missingEnvs.join(', ')}` };
  }

  // Validate each environment's value
  for (const [env, value] of Object.entries(defaultValues)) {
    if (!requiredEnvironments.includes(env)) {
      return { valid: false, error: `Invalid environment: ${env}. Must be one of: ${requiredEnvironments.join(', ')}` };
    }

    const validation = validateFlagValue(type, value);
    if (!validation.valid) {
      return { valid: false, error: `Invalid ${env} default value: ${validation.error}` };
    }
  }

  return { valid: true };
}

/**
 * Sanitize and normalize flag key
 */
export function normalizeFlagKey(input) {
  if (!input || typeof input !== 'string') return '';

  return input
    .toLowerCase()
    .replace(/[^a-z0-9_/\s]/g, '') // Remove invalid chars except spaces
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/\/{2,}/g, '/') // Replace multiple slashes with single
    .replace(/^[_/]+/, '') // Remove leading underscores/slashes
    .replace(/[_/]+$/, ''); // Remove trailing underscores/slashes
}

/**
 * Validate UUID format
 */
export function validateUUID(id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'ID is required and must be a string' };
  }

  if (!uuidRegex.test(id)) {
    return { valid: false, error: 'ID must be a valid UUID' };
  }

  return { valid: true };
}

/**
 * Validate app ID format
 */
export function validateAppId(appId) {
  if (!appId || typeof appId !== 'string') {
    return { valid: false, error: 'App ID is required and must be a string' };
  }

  if (appId.length < 1 || appId.length > 100) {
    return { valid: false, error: 'App ID must be between 1 and 100 characters' };
  }

  // Allow reverse domain notation: letters, numbers, dots, underscores, hyphens
  if (!/^[a-z0-9._-]+$/.test(appId)) {
    return { valid: false, error: 'App ID must contain only lowercase letters, numbers, dots, underscores, and hyphens' };
  }

  if (/^[0-9._-]/.test(appId)) {
    return { valid: false, error: 'App ID cannot start with a number, dot, underscore, or hyphen' };
  }

  if (appId.endsWith('.') || appId.endsWith('_') || appId.endsWith('-')) {
    return { valid: false, error: 'App ID cannot end with dot, underscore, or hyphen' };
  }

  // Cannot have consecutive dots
  if (appId.includes('..')) {
    return { valid: false, error: 'App ID cannot contain consecutive dots' };
  }

  return { valid: true };
}

/**
 * Validate environment parameter
 */
export function validateEnvironment(environment) {
  const validEnvironments = ['development', 'staging', 'production'];

  if (!environment || typeof environment !== 'string') {
    return { valid: false, error: 'Environment is required and must be a string' };
  }

  if (!validEnvironments.includes(environment)) {
    return { valid: false, error: `Invalid environment. Must be one of: ${validEnvironments.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(limit, offset) {
  const parsedLimit = parseInt(limit, 10);
  const parsedOffset = parseInt(offset, 10);

  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
    return { valid: false, error: 'Limit must be a number between 1 and 1000' };
  }

  if (isNaN(parsedOffset) || parsedOffset < 0) {
    return { valid: false, error: 'Offset must be a non-negative number' };
  }

  return { valid: true, limit: parsedLimit, offset: parsedOffset };
}

/**
 * Validation middleware wrapper
 */
export function withValidation(validationFn) {
  return (req, res, next) => {
    try {
      const result = validationFn(req);
      if (!result.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: result.error,
          details: result.details
        });
      }

      // Add validated data to request if provided
      if (result.data) {
        req.validated = result.data;
      }

      next();
    } catch (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message
      });
    }
  };
}

/**
 * Flag creation validation
 */
export function validateFlagCreation(req) {
  const { key, type, defaultValues, defaultValue, description } = req.body;
  const { appId } = req.query;

  const errors = {};

  // Validate app ID
  const appIdValidation = validateAppId(appId);
  if (!appIdValidation.valid) {
    errors.appId = appIdValidation.error;
  }

  // Validate key
  if (!key) {
    errors.key = 'Flag key is required';
  } else {
    const keyValidation = validateFlagKey(key);
    if (!keyValidation.valid) {
      errors.key = keyValidation.error;
    }
  }

  // Validate type
  if (!type) {
    errors.type = 'Flag type is required';
  } else {
    const typeValidation = validateFlagType(type);
    if (!typeValidation.valid) {
      errors.type = typeValidation.error;
    }
  }

  // Validate default values
  let envDefaultValues = defaultValues;
  if (!envDefaultValues && defaultValue !== undefined) {
    envDefaultValues = {
      development: defaultValue,
      staging: defaultValue,
      production: defaultValue
    };
  }

  if (!envDefaultValues) {
    errors.defaultValues = 'Either defaultValue or defaultValues must be provided';
  } else if (type) {
    const defaultsValidation = validateDefaultValues(type, envDefaultValues);
    if (!defaultsValidation.valid) {
      errors.defaultValues = defaultsValidation.error;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, error: 'Validation failed', details: errors };
  }

  return {
    valid: true,
    data: {
      appId,
      key: normalizeFlagKey(key),
      type: type.toLowerCase(),
      defaultValues: envDefaultValues,
      description
    }
  };
}

/**
 * Flag update validation
 */
export function validateFlagUpdate(req) {
  const { defaultValues, defaultValue, description, archived } = req.body;
  const { appId, flagId } = req.query;

  const errors = {};

  // Validate IDs
  const appIdValidation = validateAppId(appId);
  if (!appIdValidation.valid) {
    errors.appId = appIdValidation.error;
  }

  const flagIdValidation = validateUUID(flagId);
  if (!flagIdValidation.valid) {
    errors.flagId = flagIdValidation.error;
  }

  // Validate update fields if provided
  if (defaultValue !== undefined && defaultValues !== undefined) {
    errors.defaultValues = 'Cannot provide both defaultValue and defaultValues';
  }

  if (archived !== undefined && typeof archived !== 'boolean') {
    errors.archived = 'Archived must be a boolean';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, error: 'Validation failed', details: errors };
  }

  return {
    valid: true,
    data: {
      appId,
      flagId,
      updates: { defaultValues, defaultValue, description, archived }
    }
  };
}

/**
 * Publication validation
 */
export function validatePublication(req) {
  const { environment, validateOnly, keyId, generateMinimal, dryRun } = req.body;
  const { appId } = req.query;

  const errors = {};

  // Validate app ID
  const appIdValidation = validateAppId(appId);
  if (!appIdValidation.valid) {
    errors.appId = appIdValidation.error;
  }

  // Validate environment
  if (environment) {
    const envValidation = validateEnvironment(environment);
    if (!envValidation.valid) {
      errors.environment = envValidation.error;
    }
  }

  // Validate boolean flags
  if (validateOnly !== undefined && typeof validateOnly !== 'boolean') {
    errors.validateOnly = 'validateOnly must be a boolean';
  }

  if (generateMinimal !== undefined && typeof generateMinimal !== 'boolean') {
    errors.generateMinimal = 'generateMinimal must be a boolean';
  }

  if (dryRun !== undefined && typeof dryRun !== 'boolean') {
    errors.dryRun = 'dryRun must be a boolean';
  }

  // Validate keyId if provided
  if (keyId && typeof keyId !== 'string') {
    errors.keyId = 'keyId must be a string';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, error: 'Validation failed', details: errors };
  }

  return {
    valid: true,
    data: {
      appId,
      environment: environment || 'development',
      validateOnly: validateOnly || false,
      keyId,
      generateMinimal: generateMinimal || false,
      dryRun: dryRun || false
    }
  };
}