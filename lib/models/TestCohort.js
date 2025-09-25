const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

class TestCohort {
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Validate cohort key format
   */
  static validateKey(key) {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'Key is required and must be a string' };
    }

    if (key.length < 1 || key.length > 100) {
      return { valid: false, error: 'Key must be between 1 and 100 characters' };
    }

    // Similar pattern to flags but allow hyphens for cohorts
    if (!/^[a-z0-9_-]+$/.test(key)) {
      return { valid: false, error: 'Key must contain only lowercase letters, numbers, underscores, and hyphens' };
    }

    if (/^[0-9_-]/.test(key)) {
      return { valid: false, error: 'Key cannot start with a number, underscore, or hyphen' };
    }

    if (key.endsWith('_') || key.endsWith('-')) {
      return { valid: false, error: 'Key cannot end with underscore or hyphen' };
    }

    return { valid: true };
  }

  /**
   * Validate condition structure
   */
  static validateCondition(condition) {
    if (!condition || typeof condition !== 'object') {
      return { valid: false, error: 'Condition must be an object' };
    }

    const { field, operator, value } = condition;

    if (!field || typeof field !== 'string') {
      return { valid: false, error: 'Condition field is required and must be a string' };
    }

    const validOperators = ['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'in', 'nin', 'contains', 'starts_with', 'ends_with', 'mod'];
    if (!operator || !validOperators.includes(operator)) {
      return { valid: false, error: `Invalid operator. Must be one of: ${validOperators.join(', ')}` };
    }

    if (value === undefined || value === null) {
      return { valid: false, error: 'Condition value is required' };
    }

    // Operator-specific validation
    if (['in', 'nin'].includes(operator) && !Array.isArray(value)) {
      return { valid: false, error: `Operator '${operator}' requires array value` };
    }

    if (operator === 'mod') {
      if (!Number.isInteger(value) || value <= 0) {
        return { valid: false, error: 'Mod operator requires positive integer value' };
      }
    }

    return { valid: true };
  }

  /**
   * Validate array of conditions
   */
  static validateConditions(conditions) {
    if (!Array.isArray(conditions)) {
      return { valid: false, error: 'Conditions must be an array' };
    }

    for (let i = 0; i < conditions.length; i++) {
      const validation = this.validateCondition(conditions[i]);
      if (!validation.valid) {
        return { valid: false, error: `Condition ${i}: ${validation.error}` };
      }
    }

    // Check for circular references (cohort conditions referencing other cohorts)
    const cohortReferences = conditions.filter(c => c.field === 'cohort' || c.field === 'cohort_membership');
    if (cohortReferences.length > 0) {
      return { valid: false, error: 'Cohort conditions cannot reference other cohorts (circular dependency prevention)' };
    }

    return { valid: true };
  }

  /**
   * Create a new cohort
   */
  async create(appId, cohortData) {
    const { key, name, description, conditions } = cohortData;

    // Validate key
    const keyValidation = TestCohort.validateKey(key);
    if (!keyValidation.valid) {
      throw new Error(`Invalid key: ${keyValidation.error}`);
    }

    // Validate conditions
    const conditionsArray = conditions || [];
    const conditionsValidation = TestCohort.validateConditions(conditionsArray);
    if (!conditionsValidation.valid) {
      throw new Error(`Invalid conditions: ${conditionsValidation.error}`);
    }

    // Check for duplicate key in app
    const existingCohort = await this.prisma.cohort.findUnique({
      where: { appId_key: { appId, key } }
    });

    if (existingCohort) {
      throw new Error(`Cohort with key '${key}' already exists in this app`);
    }

    // Verify app exists
    const app = await this.prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      throw new Error(`App with id ${appId} not found`);
    }

    // Create cohort
    const cohort = await this.prisma.cohort.create({
      data: {
        key,
        name: name || this.generateNameFromKey(key),
        description: description || null,
        conditions: conditionsArray,
        appId
      }
    });

    return cohort;
  }

  /**
   * Get cohort by ID
   */
  async findById(cohortId, appId = null) {
    const where = { id: cohortId };
    if (appId) {
      where.appId = appId;
    }

    const cohort = await this.prisma.cohort.findUnique({ where });

    if (!cohort) {
      throw new Error('Cohort not found');
    }

    return cohort;
  }

  /**
   * Get all cohorts for an app
   */
  async findByAppId(appId) {
    return await this.prisma.cohort.findMany({
      where: { appId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Update cohort
   */
  async update(cohortId, appId, updates) {
    await this.findById(cohortId, appId); // Verify exists

    // Validate conditions if provided
    if (updates.conditions) {
      const conditionsValidation = TestCohort.validateConditions(updates.conditions);
      if (!conditionsValidation.valid) {
        throw new Error(`Invalid conditions: ${conditionsValidation.error}`);
      }
    }

    const updatedCohort = await this.prisma.cohort.update({
      where: { id: cohortId },
      data: updates
    });

    return updatedCohort;
  }

  /**
   * Delete cohort (with dependency check)
   */
  async delete(cohortId, appId) {
    const cohort = await this.findById(cohortId, appId);

    // Check for dependent rules/tests that reference this cohort
    const dependentTests = await this.prisma.testRollout.findMany({
      where: {
        OR: [
          {
            conditions: {
              path: '$[*].field',
              array_contains: 'cohort'
            }
          },
          {
            conditions: {
              path: '$[*].value',
              array_contains: cohortId
            }
          }
        ]
      }
    });

    if (dependentTests.length > 0) {
      throw new Error(`Cannot delete cohort: ${dependentTests.length} test(s)/rollout(s) reference this cohort`);
    }

    await this.prisma.cohort.delete({
      where: { id: cohortId }
    });

    return true;
  }

  /**
   * Check if a user matches cohort conditions
   */
  static evaluateUserMembership(userAttributes, conditions) {
    if (!conditions || conditions.length === 0) {
      return false; // Empty conditions = no one matches
    }

    // All conditions must pass (AND logic)
    return conditions.every(condition => {
      return this.evaluateCondition(userAttributes, condition);
    });
  }

  /**
   * Evaluate a single condition against user attributes
   */
  static evaluateCondition(userAttributes, condition) {
    const { field, operator, value } = condition;
    const userValue = userAttributes[field];

    switch (operator) {
      case 'eq':
        return userValue == value;

      case 'neq':
        return userValue != value;

      case 'gte':
        return userValue >= value;

      case 'lte':
        return userValue <= value;

      case 'gt':
        return userValue > value;

      case 'lt':
        return userValue < value;

      case 'in':
        return Array.isArray(value) && value.includes(userValue);

      case 'nin':
        return Array.isArray(value) && !value.includes(userValue);

      case 'contains':
        return typeof userValue === 'string' && userValue.includes(value);

      case 'starts_with':
        return typeof userValue === 'string' && userValue.startsWith(value);

      case 'ends_with':
        return typeof userValue === 'string' && userValue.endsWith(value);

      case 'mod':
        // Deterministic user bucketing using hash
        const hash = crypto.createHash('sha256')
          .update(`${userAttributes.user_id || 'anonymous'}_${field}`)
          .digest('hex');
        const bucket = parseInt(hash.substring(0, 8), 16) % value;
        return bucket === 0; // First bucket

      default:
        return false;
    }
  }

  /**
   * Get deterministic cohort assignment for user
   */
  async getUserCohortMemberships(appId, userAttributes) {
    const cohorts = await this.findByAppId(appId);
    const memberships = {};

    for (const cohort of cohorts) {
      const isMember = TestCohort.evaluateUserMembership(userAttributes, cohort.conditions);
      if (isMember) {
        memberships[cohort.key] = {
          id: cohort.id,
          name: cohort.name,
          matched: true
        };
      }
    }

    return memberships;
  }

  /**
   * Generate display name from key
   */
  generateNameFromKey(key) {
    return key
      .split(/[_-]/)
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
      .replace(/[^a-z0-9_\s-]/g, '') // Remove invalid chars except spaces and hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/-{2,}/g, '-') // Replace multiple hyphens with single
      .replace(/^[_-]+/, '') // Remove leading underscores/hyphens
      .replace(/[_-]+$/, ''); // Remove trailing underscores/hyphens
  }

  /**
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = TestCohort;