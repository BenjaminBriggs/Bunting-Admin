/**
 * Cryptographic utilities for JWS signing and key management
 *
 * This module provides RSA key pair generation, key rotation, and other
 * cryptographic operations required for the JWS security implementation.
 */

import { randomBytes } from 'crypto';
import { generateKeyPair } from 'crypto';
import { promisify } from 'util';

const generateKeyPairAsync = promisify(generateKeyPair);

export interface KeyPair {
  kid: string;
  publicKey: string;  // PEM format
  privateKey: string; // PEM format
  algorithm: string;
}

export interface PublicKeyInfo {
  kid: string;
  pem: string;
  algorithm: string;
}

/**
 * Generate a secure Key ID (kid) for JWS headers
 * Uses cryptographically secure random bytes encoded as hex
 */
export function generateKeyId(): string {
  const bytes = randomBytes(16);
  return bytes.toString('hex');
}

/**
 * Generate an RSA key pair for JWS signing
 * Returns both public and private keys in PEM format with a generated kid
 */
export async function generateRSAKeyPair(): Promise<KeyPair> {
  try {
    const kid = generateKeyId();

    const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
      modulusLength: 2048, // 2048-bit RSA key
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return {
      kid,
      publicKey,
      privateKey,
      algorithm: 'RS256',
    };
  } catch (error) {
    console.error('Failed to generate RSA key pair:', error);
    throw new Error('RSA key pair generation failed');
  }
}

/**
 * Validate that a PEM string is a valid RSA public key
 */
export function validatePublicKeyPEM(pem: string): boolean {
  try {
    // Check basic PEM format
    const publicKeyRegex = /^-----BEGIN PUBLIC KEY-----[\s\S]*-----END PUBLIC KEY-----$/;
    return publicKeyRegex.test(pem.trim());
  } catch (error) {
    return false;
  }
}

/**
 * Validate that a PEM string is a valid RSA private key
 */
export function validatePrivateKeyPEM(pem: string): boolean {
  try {
    // Check basic PEM format for PKCS#8 private key
    const privateKeyRegex = /^-----BEGIN PRIVATE KEY-----[\s\S]*-----END PRIVATE KEY-----$/;
    return privateKeyRegex.test(pem.trim());
  } catch (error) {
    return false;
  }
}

/**
 * Extract public key information for distribution
 * Used by the public key endpoint to return safe key data
 */
export function extractPublicKeyInfo(keyPair: KeyPair): PublicKeyInfo {
  return {
    kid: keyPair.kid,
    pem: keyPair.publicKey,
    algorithm: keyPair.algorithm,
  };
}

/**
 * Validate a Key ID format
 * Ensures the kid is a valid hex string of appropriate length
 */
export function validateKeyId(kid: string): boolean {
  // Should be a 32-character hex string (16 bytes)
  const kidRegex = /^[a-f0-9]{32}$/i;
  return kidRegex.test(kid);
}

/**
 * Generate multiple key pairs for key rotation setup
 * Useful when setting up an app with backup keys
 */
export async function generateKeyRotationSet(count: number = 2): Promise<KeyPair[]> {
  const keyPairs: KeyPair[] = [];

  for (let i = 0; i < count; i++) {
    const keyPair = await generateRSAKeyPair();
    keyPairs.push(keyPair);
  }

  return keyPairs;
}

/**
 * Security utilities for key handling
 */
export class KeySecurity {
  /**
   * Validate that private keys are never logged or exposed
   */
  static sanitizeKeyForLogging(keyPair: Partial<KeyPair>): Partial<KeyPair> {
    const sanitized = { ...keyPair };
    if (sanitized.privateKey) {
      sanitized.privateKey = '[REDACTED]';
    }
    return sanitized;
  }

  /**
   * Check if a string contains sensitive key material
   */
  static containsPrivateKey(text: string): boolean {
    return text.includes('-----BEGIN PRIVATE KEY-----') ||
           text.includes('-----BEGIN RSA PRIVATE KEY-----');
  }

  /**
   * Securely compare two key IDs to prevent timing attacks
   */
  static secureCompareKeyIds(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}