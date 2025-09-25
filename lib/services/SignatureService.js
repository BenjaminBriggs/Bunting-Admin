const jose = require('node-jose');
const crypto = require('crypto');

class SignatureService {
  constructor() {
    this.keystore = null;
  }

  /**
   * Initialize keystore from app signing keys
   */
  async initializeKeystore(signingKeys) {
    if (!Array.isArray(signingKeys) || signingKeys.length === 0) {
      throw new Error('At least one signing key is required');
    }

    this.keystore = jose.JWK.createKeyStore();

    for (const signingKey of signingKeys) {
      await this.addKeyToStore(signingKey);
    }

    return this.keystore;
  }

  /**
   * Add a signing key to the keystore
   */
  async addKeyToStore(signingKey) {
    const { kid, algorithm, publicKey, privateKey } = signingKey;

    if (!this.keystore) {
      this.keystore = jose.JWK.createKeyStore();
    }

    try {
      // Add private key for signing (if available)
      if (privateKey) {
        await this.keystore.add(privateKey, 'pem', {
          kid,
          alg: algorithm,
          use: 'sig'
        });
      } else {
        // Add public key for verification only
        await this.keystore.add(publicKey, 'pem', {
          kid,
          alg: algorithm,
          use: 'sig'
        });
      }
    } catch (error) {
      throw new Error(`Failed to add signing key '${kid}': ${error.message}`);
    }
  }

  /**
   * Sign configuration payload
   */
  async signConfig(configPayload, keyId = null) {
    if (!this.keystore) {
      throw new Error('Keystore not initialized. Call initializeKeystore() first.');
    }

    // Validate payload
    if (configPayload === null || configPayload === undefined) {
      throw new Error('Config payload cannot be null or undefined');
    }

    // Convert payload to canonical JSON string
    const payloadStr = typeof configPayload === 'string'
      ? configPayload
      : JSON.stringify(configPayload);

    try {
      // Find signing key
      let signingKey;
      if (keyId) {
        signingKey = this.keystore.get(keyId);
        if (!signingKey) {
          throw new Error(`Signing key '${keyId}' not found in keystore`);
        }
      } else {
        // Use first available key with private key material
        const keys = this.keystore.all();
        signingKey = keys.find(key => this._hasPrivateKey(key));
        if (!signingKey) {
          throw new Error('No private signing key available in keystore');
        }
      }

      // Create JWS signature
      const signature = await jose.JWS.createSign({
        format: 'compact',
        fields: {
          alg: signingKey.alg || 'RS256',
          kid: signingKey.kid
        }
      }, signingKey)
      .update(payloadStr)
      .final();

      return {
        signature,
        keyId: signingKey.kid,
        algorithm: signingKey.alg || 'RS256',
        payload: payloadStr
      };
    } catch (error) {
      throw new Error(`Failed to sign configuration: ${error.message}`);
    }
  }

  /**
   * Verify JWS signature
   */
  async verifySignature(signature, expectedPayload = null) {
    if (!this.keystore) {
      throw new Error('Keystore not initialized. Call initializeKeystore() first.');
    }

    try {
      // Verify signature
      const result = await jose.JWS.createVerify(this.keystore)
        .verify(signature);

      const payload = result.payload.toString();
      const header = result.header;

      // Check expected payload if provided
      if (expectedPayload) {
        const expectedStr = typeof expectedPayload === 'string'
          ? expectedPayload
          : JSON.stringify(expectedPayload);

        if (payload !== expectedStr) {
          throw new Error('Payload mismatch');
        }
      }

      return {
        valid: true,
        payload,
        keyId: header.kid,
        algorithm: header.alg,
        header
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        payload: null,
        keyId: null,
        algorithm: null
      };
    }
  }

  /**
   * Create detached signature (signature separate from payload)
   */
  async createDetachedSignature(configPayload, keyId = null) {
    const signResult = await this.signConfig(configPayload, keyId);

    // Parse the compact JWS to extract header and signature
    const parts = signResult.signature.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWS signature format');
    }

    const [header, payload, signature] = parts;

    // Verify the payload part matches our input
    const decodedPayload = Buffer.from(payload, 'base64url').toString();
    if (decodedPayload !== signResult.payload) {
      throw new Error('Payload encoding mismatch in JWS signature');
    }

    return {
      header,
      signature,
      keyId: signResult.keyId,
      algorithm: signResult.algorithm,
      detachedSignature: `${header}..${signature}` // Detached format
    };
  }

  /**
   * Verify detached signature
   */
  async verifyDetachedSignature(detachedSignature, configPayload) {
    try {
      // Reconstruct full JWS by adding payload
      const payloadStr = typeof configPayload === 'string'
        ? configPayload
        : JSON.stringify(configPayload);

      const payloadB64 = Buffer.from(payloadStr).toString('base64url');

      // Parse detached signature
      const parts = detachedSignature.split('..');
      if (parts.length !== 2) {
        return {
          valid: false,
          error: 'Invalid detached signature format. Expected: header..signature',
          keyId: null
        };
      }

      const [header, signature] = parts;
      const fullJws = `${header}.${payloadB64}.${signature}`;

      return await this.verifySignature(fullJws, configPayload);
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        keyId: null
      };
    }
  }

  /**
   * Generate new signing key pair
   */
  static async generateSigningKeyPair(algorithm = 'RS256', keyId = null) {
    const kid = keyId || `key-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;

    try {
      let keyPair;

      switch (algorithm) {
        case 'RS256':
        case 'PS256':
          keyPair = await jose.JWK.createKey('RSA', 2048, {
            alg: algorithm,
            use: 'sig',
            kid
          });
          break;

        case 'ES256':
          keyPair = await jose.JWK.createKey('EC', 'P-256', {
            alg: algorithm,
            use: 'sig',
            kid
          });
          break;

        default:
          throw new Error(`Unsupported algorithm: ${algorithm}`);
      }

      // Export keys in PEM format
      const privateKeyPem = keyPair.toPEM(true); // true = include private key
      const publicKeyPem = keyPair.toPEM(false); // false = public key only

      return {
        kid,
        algorithm,
        privateKey: privateKeyPem,
        publicKey: publicKeyPem,
        jwk: keyPair.toJSON(true) // JWK format with private key
      };
    } catch (error) {
      throw new Error(`Failed to generate key pair: ${error.message}`);
    }
  }

  /**
   * Extract public key from private key
   */
  static async extractPublicKey(privateKeyPem, kid, algorithm = 'RS256') {
    try {
      const keyPair = await jose.JWK.asKey(privateKeyPem, 'pem');
      const publicKeyPem = keyPair.toPEM(false);

      return {
        kid,
        algorithm,
        publicKey: publicKeyPem,
        jwk: keyPair.toJSON(false) // JWK format without private key
      };
    } catch (error) {
      throw new Error(`Failed to extract public key: ${error.message}`);
    }
  }

  /**
   * Validate key format and compatibility
   */
  static async validateSigningKey(signingKey) {
    const { kid, algorithm, publicKey, privateKey } = signingKey;

    try {
      // Validate key ID
      if (!kid || typeof kid !== 'string' || kid.length === 0) {
        throw new Error('Key ID (kid) is required');
      }

      // Validate algorithm
      const supportedAlgorithms = ['RS256', 'ES256', 'PS256'];
      if (!algorithm || !supportedAlgorithms.includes(algorithm)) {
        throw new Error(`Unsupported algorithm: ${algorithm}`);
      }

      // Validate public key
      if (!publicKey || typeof publicKey !== 'string') {
        throw new Error('Public key is required');
      }

      const pubKey = await jose.JWK.asKey(publicKey, 'pem');
      if (pubKey.kty !== 'RSA' && pubKey.kty !== 'EC') {
        throw new Error(`Unsupported key type: ${pubKey.kty}`);
      }

      // Validate private key if provided
      if (privateKey) {
        if (typeof privateKey !== 'string') {
          throw new Error('Private key must be a string');
        }

        const privKey = await jose.JWK.asKey(privateKey, 'pem');

        // Ensure public and private keys match
        const derivedPublicKeyPem = privKey.toPEM(false);
        const providedPublicKey = await jose.JWK.asKey(publicKey, 'pem');
        const providedPublicKeyPem = providedPublicKey.toPEM(false);

        if (derivedPublicKeyPem !== providedPublicKeyPem) {
          throw new Error('Public and private keys do not match');
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get keystore information
   */
  getKeystoreInfo() {
    if (!this.keystore) {
      return { initialized: false, keyCount: 0, keys: [] };
    }

    const keys = this.keystore.all();

    return {
      initialized: true,
      keyCount: keys.length,
      keys: keys.map(key => ({
        kid: key.kid,
        algorithm: key.alg,
        keyType: key.kty,
        hasPrivateKey: this._hasPrivateKey(key),
        use: key.use
      }))
    };
  }

  /**
   * Check if a JWK key has private key material
   */
  _hasPrivateKey(key) {
    // Check if this is a private key by looking for method or property
    if (typeof key.hasPrivateKey === 'boolean') {
      return key.hasPrivateKey;
    }

    // Check via toObject() to get the actual JWK data
    try {
      const jwkData = key.toObject ? key.toObject(true) : key;

      if (jwkData.kty === 'RSA') {
        return !!(jwkData.d || jwkData.p || jwkData.q);
      } else if (jwkData.kty === 'EC') {
        return !!jwkData.d;
      } else if (jwkData.kty === 'oct') {
        return !!jwkData.k;
      }
    } catch (e) {
      // If toObject fails, check directly on the key
      if (key.kty === 'RSA') {
        return !!(key.d || key.p || key.q);
      } else if (key.kty === 'EC') {
        return !!key.d;
      } else if (key.kty === 'oct') {
        return !!key.k;
      }
    }

    return false;
  }

  /**
   * Generate signature metadata
   */
  generateSignatureMetadata(signResult) {
    return {
      signedAt: new Date().toISOString(),
      keyId: signResult.keyId,
      algorithm: signResult.algorithm,
      signatureLength: signResult.signature.length,
      payloadSize: Buffer.byteLength(signResult.payload, 'utf8'),
      contentHash: crypto.createHash('sha256')
        .update(signResult.payload)
        .digest('hex')
    };
  }

  /**
   * Batch sign multiple configurations
   */
  async batchSignConfigs(configs, keyId = null) {
    const results = [];

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      try {
        const signResult = await this.signConfig(config, keyId);
        const metadata = this.generateSignatureMetadata(signResult);

        results.push({
          index: i,
          success: true,
          signature: signResult.signature,
          metadata
        });
      } catch (error) {
        results.push({
          index: i,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Clean up keystore
   */
  dispose() {
    this.keystore = null;
  }
}

module.exports = SignatureService;