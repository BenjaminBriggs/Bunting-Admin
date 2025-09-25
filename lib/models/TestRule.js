const { PrismaClient } = require('@prisma/client');

class TestRule {
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Validate rule key format
   */
  static validateKey(key) {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'Key is required and must be a string' };
    }

    if (key.length < 1 || key.length > 100) {
      return { valid: false, error: 'Key must be between 1 and 100 characters' };
    }

    // Similar to flags but allow hyphens for rules
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

    return { valid: true };
  }

  /**
   * Validate flag overrides structure
   */
  static validateFlagOverrides(flagOverrides) {
    if (!flagOverrides || typeof flagOverrides !== 'object') {
      return { valid: false, error: 'Flag overrides must be an object' };
    }

    // Check that all values are of appropriate types
    for (const [flagKey, value] of Object.entries(flagOverrides)) {
      if (typeof flagKey !== 'string') {
        return { valid: false, error: 'Flag keys must be strings' };
      }

      // Value can be any JSON-serializable type
      if (value === undefined) {
        return { valid: false, error: `Flag override for '${flagKey}' cannot be undefined` };
      }

      // Check if value is serializable
      try {
        JSON.stringify(value);
      } catch (error) {
        return { valid: false, error: `Flag override for '${flagKey}' must be JSON serializable` };
      }
    }

    return { valid: true };
  }

  /**
   * Create a new rule
   */
  async create(appId, ruleData) {
    const { key, name, description, conditions, flagOverrides, priority, environment, enabled } = ruleData;

    // Validate key
    const keyValidation = TestRule.validateKey(key);
    if (!keyValidation.valid) {
      throw new Error(`Invalid key: ${keyValidation.error}`);
    }

    // Validate conditions
    const conditionsArray = conditions || [];
    const conditionsValidation = TestRule.validateConditions(conditionsArray);
    if (!conditionsValidation.valid) {
      throw new Error(`Invalid conditions: ${conditionsValidation.error}`);
    }

    // Validate flag overrides
    const overrides = flagOverrides || {};
    const overridesValidation = TestRule.validateFlagOverrides(overrides);
    if (!overridesValidation.valid) {
      throw new Error(`Invalid flag overrides: ${overridesValidation.error}`);
    }

    // Validate environment
    const validEnvironments = ['development', 'staging', 'production'];
    if (environment && !validEnvironments.includes(environment)) {
      throw new Error(`Invalid environment. Must be one of: ${validEnvironments.join(', ')}`);
    }

    // Validate priority
    if (priority !== undefined && (!Number.isInteger(priority) || priority < 0)) {
      throw new Error('Priority must be a non-negative integer');
    }

    // Check for duplicate key in app
    const existingRule = await this.prisma.rule.findUnique({
      where: { appId_key: { appId, key } }
    });

    if (existingRule) {
      throw new Error(`Rule with key '${key}' already exists in this app`);
    }

    // Verify app exists
    const app = await this.prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      throw new Error(`App with id ${appId} not found`);
    }

    // Create rule
    const rule = await this.prisma.rule.create({
      data: {
        key,
        name: name || this.generateNameFromKey(key),
        description: description || null,
        conditions: conditionsArray,
        flagOverrides: overrides,
        priority: priority || 0,
        environment: environment || 'development',
        enabled: enabled !== false, // Default to true
        appId
      }
    });

    return rule;
  }

  /**
   * Get rule by ID
   */
  async findById(ruleId, appId = null) {
    const where = { id: ruleId };
    if (appId) {
      where.appId = appId;
    }

    const rule = await this.prisma.rule.findUnique({ where });

    if (!rule) {
      throw new Error('Rule not found');
    }

    return rule;
  }

  /**
   * Get all rules for an app
   */
  async findByAppId(appId, environment = null) {
    const where = { appId };
    if (environment) {
      where.environment = environment;
    }

    return await this.prisma.rule.findMany({
      where,
      orderBy: [
        { priority: 'desc' }, // Higher priority first
        { createdAt: 'asc' }  // Earlier rules first for same priority
      ]
    });
  }

  /**
   * Update rule
   */
  async update(ruleId, appId, updates) {
    await this.findById(ruleId, appId); // Verify exists

    // Validate conditions if provided
    if (updates.conditions) {
      const conditionsValidation = TestRule.validateConditions(updates.conditions);
      if (!conditionsValidation.valid) {
        throw new Error(`Invalid conditions: ${conditionsValidation.error}`);
      }
    }

    // Validate flag overrides if provided
    if (updates.flagOverrides) {
      const overridesValidation = TestRule.validateFlagOverrides(updates.flagOverrides);
      if (!overridesValidation.valid) {
        throw new Error(`Invalid flag overrides: ${overridesValidation.error}`);
      }
    }

    // Validate environment if provided
    if (updates.environment) {
      const validEnvironments = ['development', 'staging', 'production'];
      if (!validEnvironments.includes(updates.environment)) {
        throw new Error(`Invalid environment. Must be one of: ${validEnvironments.join(', ')}`);
      }
    }

    // Validate priority if provided
    if (updates.priority !== undefined && (!Number.isInteger(updates.priority) || updates.priority < 0)) {
      throw new Error('Priority must be a non-negative integer');
    }

    const updatedRule = await this.prisma.rule.update({
      where: { id: ruleId },
      data: updates
    });

    return updatedRule;
  }

  /**
   * Delete rule
   */
  async delete(ruleId, appId) {
    await this.findById(ruleId, appId); // Verify exists

    await this.prisma.rule.delete({
      where: { id: ruleId }
    });

    return true;
  }

  /**
   * Enable/disable rule
   */
  async setEnabled(ruleId, appId, enabled) {
    return await this.update(ruleId, appId, { enabled });
  }

  /**
   * Evaluate rules against user attributes (first match wins)
   */
  static evaluateRules(userAttributes, rules, flagDefaults = {}) {
    const result = { ...flagDefaults };

    // Rules are already ordered by priority (desc) then creation time (asc)
    for (const rule of rules) {
      if (!rule.enabled) {
        continue;
      }

      // Check if user matches all rule conditions (AND logic)
      const matches = this.evaluateRuleConditions(userAttributes, rule.conditions);

      if (matches) {
        // Apply flag overrides and return (first match wins)
        Object.assign(result, rule.flagOverrides);
        result._matchedRule = {
          id: rule.id,
          key: rule.key,
          name: rule.name,
          priority: rule.priority
        };
        break;
      }
    }

    return result;
  }

  /**
   * Evaluate rule conditions against user attributes
   */
  static evaluateRuleConditions(userAttributes, conditions) {
    if (!conditions || conditions.length === 0) {
      return true; // No conditions = matches everyone
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

    // Handle cohort membership specially
    if (field === 'cohort' || field === 'cohort_membership') {
      const cohortMemberships = userAttributes._cohortMemberships || {};
      return this.evaluateCohortCondition(cohortMemberships, operator, value);
    }

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
        // Use the same hash-based logic as cohorts
        const crypto = require('crypto');
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
   * Evaluate cohort membership condition
   */
  static evaluateCohortCondition(cohortMemberships, operator, value) {
    switch (operator) {
      case 'eq':
        return cohortMemberships[value] && cohortMemberships[value].matched;

      case 'neq':
        return !cohortMemberships[value] || !cohortMemberships[value].matched;

      case 'in':
        return Array.isArray(value) && value.some(cohortKey =>
          cohortMemberships[cohortKey] && cohortMemberships[cohortKey].matched
        );

      case 'nin':
        return !Array.isArray(value) || !value.some(cohortKey =>
          cohortMemberships[cohortKey] && cohortMemberships[cohortKey].matched
        );

      default:
        return false;
    }
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

module.exports = TestRule;