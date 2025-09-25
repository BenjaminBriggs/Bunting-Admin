const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

class TestAppConfig {
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Validate app identifier format
   */
  static validateAppId(appId) {
    if (!appId || typeof appId !== 'string') {
      return { valid: false, error: 'App ID is required and must be a string' };
    }

    if (appId.length < 1 || appId.length > 100) {
      return { valid: false, error: 'App ID must be between 1 and 100 characters' };
    }

    // Similar to flags but allow dots for reverse domain notation
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
   * Validate signing key structure
   */
  static validateSigningKey(signingKey) {
    if (!signingKey || typeof signingKey !== 'object') {
      return { valid: false, error: 'Signing key must be an object' };
    }

    const { kid, algorithm, publicKey, privateKey } = signingKey;

    // Validate key ID
    if (!kid || typeof kid !== 'string') {
      return { valid: false, error: 'Key ID (kid) is required and must be a string' };
    }

    if (kid.length < 1 || kid.length > 50) {
      return { valid: false, error: 'Key ID must be between 1 and 50 characters' };
    }

    // Validate algorithm
    const validAlgorithms = ['RS256', 'ES256', 'PS256'];
    if (!algorithm || !validAlgorithms.includes(algorithm)) {
      return { valid: false, error: `Invalid algorithm. Must be one of: ${validAlgorithms.join(', ')}` };
    }

    // Validate public key format
    if (!publicKey || typeof publicKey !== 'string') {
      return { valid: false, error: 'Public key is required and must be a string' };
    }

    if (!publicKey.includes('-----BEGIN') || !publicKey.includes('-----END')) {
      return { valid: false, error: 'Public key must be in PEM format' };
    }

    // Private key is optional (for verification-only scenarios)
    if (privateKey !== undefined) {
      if (typeof privateKey !== 'string') {
        return { valid: false, error: 'Private key must be a string if provided' };
      }

      if (!privateKey.includes('-----BEGIN') || !privateKey.includes('-----END')) {
        return { valid: false, error: 'Private key must be in PEM format' };
      }
    }

    return { valid: true };
  }

  /**
   * Validate configuration settings
   */
  static validateSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      return { valid: false, error: 'Settings must be an object' };
    }

    const {
      cdnUrl,
      publishingEnabled,
      maxConfigSize,
      signatureAlgorithm,
      cacheMaxAge,
      rateLimitRequests,
      rateLimitWindowMs
    } = settings;

    // Validate CDN URL
    if (cdnUrl !== undefined) {
      if (typeof cdnUrl !== 'string') {
        return { valid: false, error: 'CDN URL must be a string' };
      }

      try {
        new URL(cdnUrl);
      } catch (error) {
        return { valid: false, error: 'CDN URL must be a valid URL' };
      }
    }

    // Validate boolean settings
    if (publishingEnabled !== undefined && typeof publishingEnabled !== 'boolean') {
      return { valid: false, error: 'Publishing enabled must be a boolean' };
    }

    // Validate numeric settings
    if (maxConfigSize !== undefined) {
      if (!Number.isInteger(maxConfigSize) || maxConfigSize <= 0) {
        return { valid: false, error: 'Max config size must be a positive integer' };
      }
    }

    if (cacheMaxAge !== undefined) {
      if (!Number.isInteger(cacheMaxAge) || cacheMaxAge < 0) {
        return { valid: false, error: 'Cache max age must be a non-negative integer' };
      }
    }

    if (rateLimitRequests !== undefined) {
      if (!Number.isInteger(rateLimitRequests) || rateLimitRequests <= 0) {
        return { valid: false, error: 'Rate limit requests must be a positive integer' };
      }
    }

    if (rateLimitWindowMs !== undefined) {
      if (!Number.isInteger(rateLimitWindowMs) || rateLimitWindowMs <= 0) {
        return { valid: false, error: 'Rate limit window must be a positive integer' };
      }
    }

    // Validate signature algorithm
    if (signatureAlgorithm !== undefined) {
      const validAlgorithms = ['RS256', 'ES256', 'PS256'];
      if (!validAlgorithms.includes(signatureAlgorithm)) {
        return { valid: false, error: `Invalid signature algorithm. Must be one of: ${validAlgorithms.join(', ')}` };
      }
    }

    return { valid: true };
  }

  /**
   * Create a new app configuration
   */
  async create(appConfigData) {
    const { appId, name, description, signingKeys, settings } = appConfigData;

    // Validate app ID
    const appIdValidation = TestAppConfig.validateAppId(appId);
    if (!appIdValidation.valid) {
      throw new Error(`Invalid app ID: ${appIdValidation.error}`);
    }

    // Check for duplicate app ID
    const existingApp = await this.prisma.app.findUnique({
      where: { id: appId }
    });

    if (existingApp) {
      throw new Error(`App with ID '${appId}' already exists`);
    }

    // Validate signing keys
    const signingKeysArray = signingKeys || [];
    for (let i = 0; i < signingKeysArray.length; i++) {
      const keyValidation = TestAppConfig.validateSigningKey(signingKeysArray[i]);
      if (!keyValidation.valid) {
        throw new Error(`Invalid signing key ${i}: ${keyValidation.error}`);
      }
    }

    // Check for duplicate key IDs
    const keyIds = signingKeysArray.map(key => key.kid);
    const duplicateKeyIds = keyIds.filter((kid, index) => keyIds.indexOf(kid) !== index);
    if (duplicateKeyIds.length > 0) {
      throw new Error(`Duplicate key IDs found: ${duplicateKeyIds.join(', ')}`);
    }

    // Validate settings
    const appSettings = settings || this.getDefaultSettings();
    const settingsValidation = TestAppConfig.validateSettings(appSettings);
    if (!settingsValidation.valid) {
      throw new Error(`Invalid settings: ${settingsValidation.error}`);
    }

    // Generate display name from app ID if not provided
    const displayName = name || this.generateDisplayName(appId);

    // Create app configuration
    const app = await this.prisma.app.create({
      data: {
        id: appId,
        name: displayName,
        description: description || null,
        signingKeys: signingKeysArray,
        settings: appSettings,
        lastPublishedVersion: null,
        lastPublishedAt: null
      }
    });

    return app;
  }

  /**
   * Get app configuration by ID
   */
  async findById(appId) {
    const app = await this.prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      throw new Error(`App with ID '${appId}' not found`);
    }

    return app;
  }

  /**
   * Get all app configurations
   */
  async findAll() {
    return await this.prisma.app.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Update app configuration
   */
  async update(appId, updates) {
    await this.findById(appId); // Verify exists

    // Validate signing keys if provided
    if (updates.signingKeys) {
      for (let i = 0; i < updates.signingKeys.length; i++) {
        const keyValidation = TestAppConfig.validateSigningKey(updates.signingKeys[i]);
        if (!keyValidation.valid) {
          throw new Error(`Invalid signing key ${i}: ${keyValidation.error}`);
        }
      }

      // Check for duplicate key IDs
      const keyIds = updates.signingKeys.map(key => key.kid);
      const duplicateKeyIds = keyIds.filter((kid, index) => keyIds.indexOf(kid) !== index);
      if (duplicateKeyIds.length > 0) {
        throw new Error(`Duplicate key IDs found: ${duplicateKeyIds.join(', ')}`);
      }
    }

    // Validate settings if provided
    if (updates.settings) {
      const settingsValidation = TestAppConfig.validateSettings(updates.settings);
      if (!settingsValidation.valid) {
        throw new Error(`Invalid settings: ${settingsValidation.error}`);
      }
    }

    const updatedApp = await this.prisma.app.update({
      where: { id: appId },
      data: updates
    });

    return updatedApp;
  }

  /**
   * Delete app configuration (with dependency check)
   */
  async delete(appId) {
    const app = await this.findById(appId);

    // Check for dependent entities
    const flagCount = await this.prisma.flag.count({
      where: { appId }
    });

    const cohortCount = await this.prisma.cohort.count({
      where: { appId }
    });

    const ruleCount = await this.prisma.rule.count({
      where: { appId }
    });

    if (flagCount > 0 || cohortCount > 0 || ruleCount > 0) {
      throw new Error(
        `Cannot delete app: has ${flagCount} flag(s), ${cohortCount} cohort(s), and ${ruleCount} rule(s). ` +
        'Delete all dependent entities first.'
      );
    }

    await this.prisma.app.delete({
      where: { id: appId }
    });

    return true;
  }

  /**
   * Add or update signing key
   */
  async addSigningKey(appId, signingKey) {
    const app = await this.findById(appId);

    // Validate signing key
    const keyValidation = TestAppConfig.validateSigningKey(signingKey);
    if (!keyValidation.valid) {
      throw new Error(`Invalid signing key: ${keyValidation.error}`);
    }

    // Get current keys
    const currentKeys = app.signingKeys || [];

    // Check for duplicate key ID
    const existingKeyIndex = currentKeys.findIndex(key => key.kid === signingKey.kid);

    let updatedKeys;
    if (existingKeyIndex >= 0) {
      // Update existing key
      updatedKeys = [...currentKeys];
      updatedKeys[existingKeyIndex] = signingKey;
    } else {
      // Add new key
      updatedKeys = [...currentKeys, signingKey];
    }

    return await this.update(appId, { signingKeys: updatedKeys });
  }

  /**
   * Remove signing key
   */
  async removeSigningKey(appId, keyId) {
    const app = await this.findById(appId);
    const currentKeys = app.signingKeys || [];

    // Don't allow removing the last key
    if (currentKeys.length <= 1) {
      throw new Error('Cannot remove the last signing key. Add a replacement key first.');
    }

    const updatedKeys = currentKeys.filter(key => key.kid !== keyId);

    if (updatedKeys.length === currentKeys.length) {
      throw new Error(`Signing key with ID '${keyId}' not found`);
    }

    return await this.update(appId, { signingKeys: updatedKeys });
  }

  /**
   * Update last published version
   */
  async updateLastPublished(appId, version) {
    return await this.update(appId, {
      lastPublishedVersion: version,
      lastPublishedAt: new Date()
    });
  }

  /**
   * Generate display name from app ID
   */
  generateDisplayName(appId) {
    return appId
      .split(/[._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get default settings
   */
  getDefaultSettings() {
    return {
      cdnUrl: null,
      publishingEnabled: true,
      maxConfigSize: 1048576, // 1MB
      signatureAlgorithm: 'RS256',
      cacheMaxAge: 300, // 5 minutes
      rateLimitRequests: 100,
      rateLimitWindowMs: 60000 // 1 minute
    };
  }

  /**
   * Generate signing key pair (for testing purposes)
   */
  static generateTestSigningKey(kid = null) {
    const keyId = kid || `test-key-${Date.now()}`;

    // In a real implementation, you would use crypto.generateKeyPair
    // For testing, we'll use a mock structure
    return {
      kid: keyId,
      algorithm: 'RS256',
      publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----'
    };
  }

  /**
   * Validate app isolation (ensure operations are scoped to correct app)
   */
  static validateAppIsolation(requestAppId, entityAppId) {
    if (requestAppId !== entityAppId) {
      throw new Error(`Access denied: entity belongs to app '${entityAppId}', not '${requestAppId}'`);
    }
  }

  /**
   * Get app statistics
   */
  async getStats(appId) {
    await this.findById(appId); // Verify exists

    const [flagCount, cohortCount, ruleCount, publicationCount] = await Promise.all([
      this.prisma.flag.count({ where: { appId } }),
      this.prisma.cohort.count({ where: { appId } }),
      this.prisma.rule.count({ where: { appId } }),
      this.prisma.publication.count({ where: { appId } })
    ]);

    return {
      flags: flagCount,
      cohorts: cohortCount,
      rules: ruleCount,
      publications: publicationCount
    };
  }

  /**
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = TestAppConfig;