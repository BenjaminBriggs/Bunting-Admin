const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

class TestFlag {
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Validate flag key format
   */
  static validateKey(key) {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'Key is required and must be a string' };
    }

    if (key.length < 1 || key.length > 100) {
      return { valid: false, error: 'Key must be between 1 and 100 characters' };
    }

    // Must match /^[a-z0-9_/]+$/ pattern
    if (!/^[a-z0-9_/]+$/.test(key)) {
      return { valid: false, error: 'Key must contain only lowercase letters, numbers, underscores, and forward slashes' };
    }

    // Cannot start with number or underscore
    if (/^[0-9_]/.test(key)) {
      return { valid: false, error: 'Key cannot start with a number or underscore' };
    }

    // Cannot have trailing underscore or slash
    if (key.endsWith('_') || key.endsWith('/')) {
      return { valid: false, error: 'Key cannot end with underscore or slash' };
    }

    // Cannot have double slashes
    if (key.includes('//')) {
      return { valid: false, error: 'Key cannot contain consecutive slashes' };
    }

    // Cannot start with slash
    if (key.startsWith('/')) {
      return { valid: false, error: 'Key cannot start with slash' };
    }

    return { valid: true };
  }

  /**
   * Validate flag type and default value compatibility
   */
  static validateTypeAndValue(type, value) {
    const validTypes = ['bool', 'string', 'int', 'double', 'date', 'json'];

    if (!validTypes.includes(type)) {
      return { valid: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` };
    }

    // Type-specific validation
    switch (type) {
      case 'bool':
        if (typeof value !== 'boolean') {
          return { valid: false, error: 'Boolean flag must have boolean default value' };
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, error: 'String flag must have string default value' };
        }
        break;

      case 'int':
        if (!Number.isInteger(value)) {
          return { valid: false, error: 'Int flag must have integer default value' };
        }
        if (value < -2147483648 || value > 2147483647) {
          return { valid: false, error: 'Int value must be within 32-bit integer range' };
        }
        break;

      case 'double':
        if (typeof value !== 'number' || !isFinite(value)) {
          return { valid: false, error: 'Double flag must have finite number default value' };
        }
        break;

      case 'date':
        if (typeof value !== 'string') {
          return { valid: false, error: 'Date flag must have ISO8601 string default value' };
        }
        const date = new Date(value);
        if (date.toString() === 'Invalid Date' || date.toISOString() !== value) {
          return { valid: false, error: 'Date value must be valid ISO8601 string' };
        }
        break;

      case 'json':
        if (typeof value !== 'string') {
          return { valid: false, error: 'JSON flag must have string default value' };
        }
        try {
          JSON.parse(value);
        } catch (error) {
          return { valid: false, error: 'JSON flag value must be valid JSON string' };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Validate environment-specific default values
   */
  static validateDefaultValues(type, defaultValues) {
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

      const validation = this.validateTypeAndValue(type, value);
      if (!validation.valid) {
        return { valid: false, error: `Invalid ${env} default value: ${validation.error}` };
      }
    }

    return { valid: true };
  }

  /**
   * Create a new flag
   */
  async create(appId, flagData) {
    const { key, type, defaultValue, defaultValues, description } = flagData;

    // Validate key
    const keyValidation = TestFlag.validateKey(key);
    if (!keyValidation.valid) {
      throw new Error(`Invalid key: ${keyValidation.error}`);
    }

    // Check for duplicate key in app
    const existingFlag = await this.prisma.flag.findUnique({
      where: { appId_key: { appId, key } }
    });

    if (existingFlag) {
      throw new Error(`Flag with key '${key}' already exists in this app`);
    }

    // Handle backward compatibility with single defaultValue
    let envDefaultValues = defaultValues;
    if (!envDefaultValues && defaultValue !== undefined) {
      envDefaultValues = {
        development: defaultValue,
        staging: defaultValue,
        production: defaultValue
      };
    }

    // Validate type and default values
    if (!envDefaultValues) {
      throw new Error('Either defaultValue or defaultValues must be provided');
    }

    const typeValidation = TestFlag.validateDefaultValues(type, envDefaultValues);
    if (!typeValidation.valid) {
      throw new Error(typeValidation.error);
    }

    // Verify app exists
    const app = await this.prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      throw new Error(`App with id ${appId} not found`);
    }

    // Generate display name from key
    const displayName = this.generateDisplayName(key);

    // Create flag
    const flag = await this.prisma.flag.create({
      data: {
        key,
        displayName,
        type: type.toUpperCase(), // Prisma enum is uppercase
        description: description || null,
        defaultValues: envDefaultValues,
        variants: {},
        appId,
        archived: false
      }
    });

    return flag;
  }

  /**
   * Get flag by ID
   */
  async findById(flagId, appId = null) {
    const where = { id: flagId };
    if (appId) {
      where.appId = appId;
    }

    const flag = await this.prisma.flag.findUnique({ where });

    if (!flag) {
      throw new Error('Flag not found');
    }

    return flag;
  }

  /**
   * Get all flags for an app
   */
  async findByAppId(appId) {
    return await this.prisma.flag.findMany({
      where: {
        appId,
        archived: false
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Update flag
   */
  async update(flagId, appId, updates) {
    const flag = await this.findById(flagId, appId);

    // Validate updates
    if (updates.defaultValues) {
      const typeValidation = TestFlag.validateDefaultValues(flag.type.toLowerCase(), updates.defaultValues);
      if (!typeValidation.valid) {
        throw new Error(typeValidation.error);
      }
    }

    if (updates.defaultValue !== undefined && !updates.defaultValues) {
      // Handle single defaultValue update
      const currentDefaults = flag.defaultValues || {};
      updates.defaultValues = {
        ...currentDefaults,
        development: updates.defaultValue,
        staging: updates.defaultValue,
        production: updates.defaultValue
      };
      delete updates.defaultValue;
    }

    const updatedFlag = await this.prisma.flag.update({
      where: { id: flagId },
      data: updates
    });

    return updatedFlag;
  }

  /**
   * Delete flag (with dependency check)
   */
  async delete(flagId, appId) {
    const flag = await this.findById(flagId, appId);

    // Check for dependent rules/tests
    const dependentTests = await this.prisma.testRollout.findMany({
      where: {
        flagIds: {
          path: '$',
          array_contains: flagId
        }
      }
    });

    if (dependentTests.length > 0) {
      throw new Error(`Cannot delete flag: ${dependentTests.length} test(s)/rollout(s) depend on this flag`);
    }

    await this.prisma.flag.delete({
      where: { id: flagId }
    });

    return true;
  }

  /**
   * Archive/unarchive flag
   */
  async archive(flagId, appId, archived = true) {
    return await this.update(flagId, appId, {
      archived,
      archivedAt: archived ? new Date() : null
    });
  }

  /**
   * Generate display name from key
   */
  generateDisplayName(key) {
    return key
      .split(/[/_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Normalize user input key
   */
  static normalizeKey(input) {
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
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = TestFlag;