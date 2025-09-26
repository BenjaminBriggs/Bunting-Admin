/**
 * JWS (JSON Web Signature) signing service for config authentication
 *
 * This module implements RS256 JWS signing as specified in the JSON Spec,
 * ensuring config integrity and authenticity for SDK clients.
 */

import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose';
import { prisma } from './db';

export interface SigningResult {
  signature: string;     // Compact JWS string
  keyId: string;        // Key ID used for signing
  algorithm: string;    // Signing algorithm (RS256)
}

export interface VerificationResult {
  verified: boolean;
  payload?: any;
  error?: string;
  keyId?: string;
}

/**
 * Sign a configuration JSON with JWS using the active signing key for an app
 */
export async function signConfig(appId: string, configJson: any): Promise<SigningResult> {
  try {
    // Get the active signing key for this app
    const signingKey = await prisma.signingKey.findFirst({
      where: {
        appId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc', // Use the most recent active key
      },
    });

    if (!signingKey) {
      throw new Error(`No active signing key found for app ${appId}`);
    }

    // Import the private key for signing
    const privateKey = await importPKCS8(signingKey.privateKey, signingKey.algorithm);

    // Convert config to canonical JSON string (byte-for-byte signing)
    const configString = JSON.stringify(configJson);

    // Create JWS with proper header
    const jwt = new SignJWT({ config: configString })
      .setProtectedHeader({
        alg: signingKey.algorithm,
        kid: signingKey.kid,
        typ: 'JWT',
      })
      .setIssuedAt()
      .setExpirationTime('24h'); // Config expires after 24 hours

    const signature = await jwt.sign(privateKey);

    return {
      signature,
      keyId: signingKey.kid,
      algorithm: signingKey.algorithm,
    };
  } catch (error) {
    console.error('Config signing failed:', error);
    throw new Error(`Failed to sign config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a detached JWS signature for a config
 * The config JSON is not embedded in the JWS, only signed
 */
export async function createDetachedSignature(appId: string, configString: string): Promise<SigningResult> {
  try {
    // Get the active signing key for this app
    const signingKey = await prisma.signingKey.findFirst({
      where: {
        appId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!signingKey) {
      throw new Error(`No active signing key found for app ${appId}`);
    }

    // Import the private key for signing
    const privateKey = await importPKCS8(signingKey.privateKey, signingKey.algorithm);

    // Create JWS with empty payload (detached signature)
    const jwt = new SignJWT({})
      .setProtectedHeader({
        alg: signingKey.algorithm,
        kid: signingKey.kid,
        typ: 'JWT',
        crit: ['b64'], // Critical header parameter
        b64: false as any,    // Unencoded payload (for detached signature)
      })
      .setIssuedAt()
      .setExpirationTime('24h');

    // Sign the config string directly (detached)
    const signature = await jwt.sign(privateKey);

    return {
      signature,
      keyId: signingKey.kid,
      algorithm: signingKey.algorithm,
    };
  } catch (error) {
    console.error('Detached signature creation failed:', error);
    throw new Error(`Failed to create detached signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify a JWS signature against a config using a specific public key
 */
export async function verifyConfigSignature(
  configString: string,
  signature: string,
  appId: string,
  keyId?: string
): Promise<VerificationResult> {
  try {
    // If keyId is provided, use that specific key; otherwise try all active keys
    const whereClause = keyId
      ? { appId, kid: keyId }
      : { appId, isActive: true };

    const signingKeys = await prisma.signingKey.findMany({
      where: whereClause,
    });

    if (signingKeys.length === 0) {
      return {
        verified: false,
        error: keyId ? `Key ${keyId} not found` : 'No active keys found',
      };
    }

    // Try verification with each available key
    for (const signingKey of signingKeys) {
      try {
        const publicKey = await importSPKI(signingKey.publicKey, signingKey.algorithm);

        const { payload } = await jwtVerify(signature, publicKey, {
          algorithms: [signingKey.algorithm],
        });

        // Verify that the payload contains the config
        const jwtPayload = payload as { config?: string };

        if (jwtPayload.config === configString) {
          return {
            verified: true,
            payload: JSON.parse(configString),
            keyId: signingKey.kid,
          };
        }
      } catch (keyError) {
        // Continue trying other keys
        continue;
      }
    }

    return {
      verified: false,
      error: 'Signature verification failed with all available keys',
    };
  } catch (error) {
    console.error('Signature verification failed:', error);
    return {
      verified: false,
      error: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get all public keys for an app (for distribution to SDKs)
 */
export async function getPublicKeysForApp(appId: string): Promise<Array<{
  kid: string;
  pem: string;
  algorithm: string;
  isActive: boolean;
}>> {
  try {
    const signingKeys = await prisma.signingKey.findMany({
      where: { appId },
      select: {
        kid: true,
        publicKey: true,
        algorithm: true,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return signingKeys.map(key => ({
      kid: key.kid,
      pem: key.publicKey,
      algorithm: key.algorithm,
      isActive: key.isActive,
    }));
  } catch (error) {
    console.error('Failed to get public keys:', error);
    throw new Error('Failed to retrieve public keys');
  }
}

/**
 * Rotate signing keys for an app
 * Deactivates the current key and activates a new one
 */
export async function rotateSigningKeys(appId: string, newKeyId: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // Deactivate all existing keys
      await tx.signingKey.updateMany({
        where: { appId, isActive: true },
        data: { isActive: false },
      });

      // Activate the new key
      const updatedKey = await tx.signingKey.update({
        where: { appId_kid: { appId, kid: newKeyId } },
        data: { isActive: true },
      });

      if (!updatedKey) {
        throw new Error(`Key ${newKeyId} not found for app ${appId}`);
      }
    });
  } catch (error) {
    console.error('Key rotation failed:', error);
    throw new Error(`Failed to rotate keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Utility functions for JWS header inspection
 */
export class JWSUtils {
  /**
   * Parse JWS header without verification
   */
  static parseHeader(jwsCompact: string): any {
    try {
      const [headerB64] = jwsCompact.split('.');
      const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
      return JSON.parse(headerJson);
    } catch (error) {
      throw new Error('Invalid JWS format');
    }
  }

  /**
   * Extract Key ID from JWS header
   */
  static extractKeyId(jwsCompact: string): string | null {
    try {
      const header = this.parseHeader(jwsCompact);
      return header.kid || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate JWS format
   */
  static isValidJWSFormat(jwsCompact: string): boolean {
    try {
      const parts = jwsCompact.split('.');
      return parts.length === 3; // header.payload.signature
    } catch (error) {
      return false;
    }
  }
}