const ConfigGenerator = require('./ConfigGenerator');
const SignatureService = require('./SignatureService');
const TestAppConfig = require('../models/TestAppConfig');

class PublicationService {
  constructor(prisma) {
    this.prisma = prisma;
    this.configGenerator = new ConfigGenerator(prisma);
    this.signatureService = new SignatureService();
    this.appConfigModel = new TestAppConfig(prisma);
  }

  /**
   * Publish configuration for an app and environment
   */
  async publishConfig(appId, environment = 'development', options = {}) {
    const {
      validateOnly = false,
      keyId = null,
      generateMinimal = false,
      dryRun = false
    } = options;

    try {
      // Validate app and environment
      const app = await this.appConfigModel.findById(appId);

      const validEnvironments = ['development', 'staging', 'production'];
      if (!validEnvironments.includes(environment)) {
        throw new Error(`Invalid environment: ${environment}`);
      }

      // Check if publishing is enabled for this app
      const settings = app.settings || {};
      if (settings.publishingEnabled === false) {
        throw new Error(`Publishing is disabled for app '${appId}'`);
      }

      // Generate configuration
      const config = generateMinimal
        ? await this.configGenerator.generateMinimalConfig(appId, environment)
        : await this.configGenerator.generateConfig(appId, environment);

      // Validate configuration size
      const configSize = this.configGenerator.calculateConfigSize(config);
      const maxConfigSize = settings.maxConfigSize || 1048576; // 1MB default

      if (configSize > maxConfigSize) {
        throw new Error(`Configuration size (${configSize} bytes) exceeds maximum allowed size (${maxConfigSize} bytes)`);
      }

      const validationResult = {
        valid: true,
        config,
        configSize,
        metadata: {
          flagCount: config.metadata.flagCount,
          cohortCount: config.metadata.cohortCount,
          ruleCount: config.metadata.ruleCount,
          environment,
          generatedAt: config.generatedAt
        }
      };

      // Return validation result if only validating
      if (validateOnly) {
        return validationResult;
      }

      // Initialize signature service with app's signing keys
      const signingKeys = app.signingKeys || [];
      if (signingKeys.length === 0) {
        throw new Error(`No signing keys configured for app '${appId}'`);
      }

      await this.signatureService.initializeKeystore(signingKeys);

      // Generate version for this publication
      const version = await this.generateVersion(appId, environment);
      config.version = version;

      // Sign configuration
      const signResult = await this.signatureService.signConfig(config, keyId);
      const detachedSignResult = await this.signatureService.createDetachedSignature(config, keyId);

      const publicationData = {
        appId,
        environment,
        version,
        config,
        configSize,
        signature: signResult.signature,
        detachedSignature: detachedSignResult.detachedSignature,
        keyId: signResult.keyId,
        algorithm: signResult.algorithm,
        publishedAt: new Date(),
        publishedBy: 'system', // In real implementation, would be user ID
        status: 'published'
      };

      // Return dry run result without persisting
      if (dryRun) {
        return {
          success: true,
          dryRun: true,
          publication: publicationData,
          validation: validationResult
        };
      }

      // Save publication record
      const publication = await this.createPublicationRecord(publicationData);

      // Update app's last published version
      await this.appConfigModel.updateLastPublished(appId, version);

      return {
        success: true,
        publication,
        config,
        signature: signResult.signature,
        detachedSignature: detachedSignResult.detachedSignature,
        metadata: {
          version,
          configSize,
          keyId: signResult.keyId,
          publishedAt: publication.publishedAt
        }
      };

    } catch (error) {
      throw new Error(`Publication failed: ${error.message}`);
    }
  }

  /**
   * Generate version for publication (YYYY-MM-DD.N format)
   */
  async generateVersion(appId, environment) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const datePrefix = `${year}-${month}-${day}`;

    // Find highest version number for today
    const existingPublications = await this.prisma.publication.findMany({
      where: {
        appId,
        environment,
        version: {
          startsWith: datePrefix
        }
      },
      orderBy: {
        version: 'desc'
      },
      take: 1
    });

    let versionNumber = 1;
    if (existingPublications.length > 0) {
      const lastVersion = existingPublications[0].version;
      const lastNumber = parseInt(lastVersion.split('.')[1] || '0', 10);
      versionNumber = lastNumber + 1;
    }

    return `${datePrefix}.${versionNumber}`;
  }

  /**
   * Create publication record in database
   */
  async createPublicationRecord(publicationData) {
    return await this.prisma.publication.create({
      data: {
        appId: publicationData.appId,
        environment: publicationData.environment,
        version: publicationData.version,
        config: publicationData.config,
        configSize: publicationData.configSize,
        signature: publicationData.signature,
        detachedSignature: publicationData.detachedSignature,
        keyId: publicationData.keyId,
        algorithm: publicationData.algorithm,
        publishedAt: publicationData.publishedAt,
        publishedBy: publicationData.publishedBy,
        status: publicationData.status
      }
    });
  }

  /**
   * Get publication by version
   */
  async getPublication(appId, environment, version) {
    const publication = await this.prisma.publication.findUnique({
      where: {
        appId_environment_version: {
          appId,
          environment,
          version
        }
      }
    });

    if (!publication) {
      throw new Error(`Publication not found: ${appId}/${environment}/${version}`);
    }

    return publication;
  }

  /**
   * Get latest publication for app and environment
   */
  async getLatestPublication(appId, environment) {
    const publication = await this.prisma.publication.findFirst({
      where: {
        appId,
        environment,
        status: 'published'
      },
      orderBy: {
        publishedAt: 'desc'
      }
    });

    if (!publication) {
      throw new Error(`No publications found for app '${appId}' in environment '${environment}'`);
    }

    return publication;
  }

  /**
   * List all publications for an app
   */
  async listPublications(appId, environment = null, options = {}) {
    const { limit = 50, offset = 0, includeConfig = false } = options;

    const where = { appId };
    if (environment) {
      where.environment = environment;
    }

    const select = {
      id: true,
      appId: true,
      environment: true,
      version: true,
      configSize: true,
      keyId: true,
      algorithm: true,
      publishedAt: true,
      publishedBy: true,
      status: true
    };

    if (includeConfig) {
      select.config = true;
      select.signature = true;
      select.detachedSignature = true;
    }

    const publications = await this.prisma.publication.findMany({
      where,
      select,
      orderBy: {
        publishedAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    const total = await this.prisma.publication.count({ where });

    return {
      publications,
      total,
      limit,
      offset,
      hasMore: offset + publications.length < total
    };
  }

  /**
   * Verify publication signature
   */
  async verifyPublication(appId, environment, version) {
    const publication = await this.getPublication(appId, environment, version);
    const app = await this.appConfigModel.findById(appId);

    // Initialize signature service with app's signing keys
    await this.signatureService.initializeKeystore(app.signingKeys);

    // Verify signature
    const verificationResult = await this.signatureService.verifySignature(
      publication.signature,
      publication.config
    );

    return {
      valid: verificationResult.valid,
      error: verificationResult.error,
      keyId: verificationResult.keyId,
      algorithm: verificationResult.algorithm,
      publication: {
        id: publication.id,
        version: publication.version,
        publishedAt: publication.publishedAt
      }
    };
  }

  /**
   * Rollback to previous publication
   */
  async rollbackPublication(appId, environment, targetVersion) {
    // Verify target publication exists and is valid
    const targetPublication = await this.getPublication(appId, environment, targetVersion);

    if (targetPublication.status !== 'published') {
      throw new Error(`Cannot rollback to publication with status '${targetPublication.status}'`);
    }

    // Verify signature of target publication
    const verificationResult = await this.verifyPublication(appId, environment, targetVersion);
    if (!verificationResult.valid) {
      throw new Error(`Cannot rollback to publication with invalid signature: ${verificationResult.error}`);
    }

    // Create new publication record with same config but new version
    const newVersion = await this.generateVersion(appId, environment);

    const rollbackPublication = await this.createPublicationRecord({
      appId,
      environment,
      version: newVersion,
      config: targetPublication.config,
      configSize: targetPublication.configSize,
      signature: targetPublication.signature,
      detachedSignature: targetPublication.detachedSignature,
      keyId: targetPublication.keyId,
      algorithm: targetPublication.algorithm,
      publishedAt: new Date(),
      publishedBy: 'system', // In real implementation, would be user ID
      status: 'published'
    });

    // Update app's last published version
    await this.appConfigModel.updateLastPublished(appId, newVersion);

    return {
      success: true,
      rolledBackTo: targetVersion,
      newVersion,
      publication: rollbackPublication
    };
  }

  /**
   * Get publication statistics
   */
  async getPublicationStats(appId, environment = null) {
    const where = { appId };
    if (environment) {
      where.environment = environment;
    }

    const [total, published, latest] = await Promise.all([
      this.prisma.publication.count({ where }),
      this.prisma.publication.count({ where: { ...where, status: 'published' } }),
      this.prisma.publication.findFirst({
        where: { ...where, status: 'published' },
        orderBy: { publishedAt: 'desc' },
        select: { version: true, publishedAt: true, configSize: true }
      })
    ]);

    // Calculate average config size
    const sizeStats = await this.prisma.publication.aggregate({
      where: { ...where, status: 'published' },
      _avg: { configSize: true },
      _max: { configSize: true },
      _min: { configSize: true }
    });

    return {
      total,
      published,
      latest: latest ? {
        version: latest.version,
        publishedAt: latest.publishedAt,
        configSize: latest.configSize
      } : null,
      configSize: {
        average: Math.round(sizeStats._avg.configSize || 0),
        maximum: sizeStats._max.configSize || 0,
        minimum: sizeStats._min.configSize || 0
      }
    };
  }

  /**
   * Clean up old publications (keep only N most recent)
   */
  async cleanupOldPublications(appId, environment, keepCount = 10) {
    const publications = await this.prisma.publication.findMany({
      where: { appId, environment },
      orderBy: { publishedAt: 'desc' },
      select: { id: true }
    });

    if (publications.length <= keepCount) {
      return { deleted: 0, kept: publications.length };
    }

    const toDelete = publications.slice(keepCount);
    const deleteIds = toDelete.map(p => p.id);

    const deleteResult = await this.prisma.publication.deleteMany({
      where: {
        id: { in: deleteIds }
      }
    });

    return {
      deleted: deleteResult.count,
      kept: publications.length - deleteResult.count
    };
  }

  /**
   * Validate publication pipeline
   */
  async validatePipeline(appId) {
    const app = await this.appConfigModel.findById(appId);
    const issues = [];

    // Check signing keys
    if (!app.signingKeys || app.signingKeys.length === 0) {
      issues.push({
        type: 'error',
        category: 'signing',
        message: 'No signing keys configured'
      });
    } else {
      // Validate each signing key
      for (let i = 0; i < app.signingKeys.length; i++) {
        const keyValidation = await SignatureService.validateSigningKey(app.signingKeys[i]);
        if (!keyValidation.valid) {
          issues.push({
            type: 'error',
            category: 'signing',
            message: `Invalid signing key ${i}: ${keyValidation.error}`
          });
        }
      }
    }

    // Check app settings
    const settings = app.settings || {};
    if (settings.publishingEnabled === false) {
      issues.push({
        type: 'warning',
        category: 'settings',
        message: 'Publishing is disabled for this app'
      });
    }

    // Check for flags, cohorts, and rules
    const stats = await this.appConfigModel.getStats(appId);
    if (stats.flags === 0) {
      issues.push({
        type: 'warning',
        category: 'content',
        message: 'No flags configured'
      });
    }

    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      issues,
      stats
    };
  }

  /**
   * Dispose of resources
   */
  dispose() {
    if (this.signatureService) {
      this.signatureService.dispose();
    }
  }
}

module.exports = PublicationService;