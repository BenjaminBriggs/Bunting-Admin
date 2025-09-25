/**
 * Unit tests for JWS crypto functionality (no database required)
 */

import { describe, it, expect } from '@jest/globals';
import { generateRSAKeyPair, validatePublicKeyPEM, validatePrivateKeyPEM, validateKeyId, generateKeyId } from '../src/lib/crypto';
import { JWSUtils } from '../src/lib/jws-signer';
import { validateJWSFormat } from '../src/lib/crypto-test-utils';

describe('Crypto Unit Tests (No Database)', () => {
  describe('Key Generation', () => {
    it('should generate valid RSA key pairs', async () => {
      const keyPair = await generateRSAKeyPair();

      expect(keyPair.kid).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.algorithm).toBe('RS256');

      // Validate key formats
      expect(validatePublicKeyPEM(keyPair.publicKey)).toBe(true);
      expect(validatePrivateKeyPEM(keyPair.privateKey)).toBe(true);
      expect(validateKeyId(keyPair.kid)).toBe(true);
    });

    it('should generate unique key IDs', async () => {
      const keyPair1 = await generateRSAKeyPair();
      const keyPair2 = await generateRSAKeyPair();

      expect(keyPair1.kid).not.toBe(keyPair2.kid);
    });

    it('should generate valid PEM format keys', async () => {
      const keyPair = await generateRSAKeyPair();

      expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(keyPair.publicKey).toContain('-----END PUBLIC KEY-----');
      expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(keyPair.privateKey).toContain('-----END PRIVATE KEY-----');
    });

    it('should generate 32-character hex key IDs', async () => {
      const keyPair = await generateRSAKeyPair();

      expect(keyPair.kid).toMatch(/^[a-f0-9]{32}$/i);
      expect(keyPair.kid.length).toBe(32);
    });
  });

  describe('Key ID Generation', () => {
    it('should generate valid key IDs', () => {
      const kid = generateKeyId();

      expect(kid).toBeDefined();
      expect(typeof kid).toBe('string');
      expect(kid.length).toBe(32);
      expect(kid).toMatch(/^[a-f0-9]+$/i);
    });

    it('should generate unique key IDs', () => {
      const kid1 = generateKeyId();
      const kid2 = generateKeyId();

      expect(kid1).not.toBe(kid2);
    });
  });

  describe('Key Validation', () => {
    it('should validate public key PEM format', async () => {
      const keyPair = await generateRSAKeyPair();

      expect(validatePublicKeyPEM(keyPair.publicKey)).toBe(true);
      expect(validatePublicKeyPEM('invalid-key')).toBe(false);
      expect(validatePublicKeyPEM('')).toBe(false);
    });

    it('should validate private key PEM format', async () => {
      const keyPair = await generateRSAKeyPair();

      expect(validatePrivateKeyPEM(keyPair.privateKey)).toBe(true);
      expect(validatePrivateKeyPEM('invalid-key')).toBe(false);
      expect(validatePrivateKeyPEM('')).toBe(false);
    });

    it('should validate key ID format', () => {
      expect(validateKeyId('abcdef1234567890abcdef1234567890')).toBe(true);
      expect(validateKeyId('ABCDEF1234567890ABCDEF1234567890')).toBe(true);
      expect(validateKeyId('invalid-kid')).toBe(false);
      expect(validateKeyId('12345')).toBe(false);
      expect(validateKeyId('')).toBe(false);
    });
  });

  describe('JWS Format Validation', () => {
    it('should validate proper JWS format', () => {
      // Create a mock JWS with proper structure
      const header = { alg: 'RS256', kid: 'test-kid-123456789012345678901234', typ: 'JWT' };
      const payload = { test: 'data' };

      const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = 'mock-signature-data';

      const jws = `${headerB64}.${payloadB64}.${signature}`;

      const result = validateJWSFormat(jws);
      expect(result.success).toBe(true);
      expect(result.details?.algorithm).toBe('RS256');
      expect(result.details?.keyId).toBe('test-kid-123456789012345678901234');
    });

    it('should reject invalid JWS format', () => {
      const result1 = validateJWSFormat('invalid-jws');
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('3 parts separated by dots');

      const result2 = validateJWSFormat('part1.part2');
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('3 parts separated by dots');

      const result3 = validateJWSFormat('part1.part2.part3.part4');
      expect(result3.success).toBe(false);
      expect(result3.error).toContain('3 parts separated by dots');
    });

    it('should reject JWS with invalid header', () => {
      const invalidHeader = 'invalid-base64';
      const validPayload = Buffer.from('{}').toString('base64url');
      const signature = 'signature';

      const jws = `${invalidHeader}.${validPayload}.${signature}`;

      const result = validateJWSFormat(jws);
      expect(result.success).toBe(false);
      expect(result.error).toContain('decode or parse JWS header');
    });

    it('should reject JWS with missing required header fields', () => {
      const incompleteHeader = { alg: 'RS256' }; // Missing kid
      const headerB64 = Buffer.from(JSON.stringify(incompleteHeader)).toString('base64url');
      const payloadB64 = Buffer.from('{}').toString('base64url');
      const signature = 'signature';

      const jws = `${headerB64}.${payloadB64}.${signature}`;

      const result = validateJWSFormat(jws);
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing required alg or kid fields');
    });
  });

  describe('JWS Utils', () => {
    it('should parse JWS header correctly', () => {
      const header = { alg: 'RS256', kid: 'test-kid', typ: 'JWT' };
      const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const jws = `${headerB64}.payload.signature`;

      const parsedHeader = JWSUtils.parseHeader(jws);
      expect(parsedHeader.alg).toBe('RS256');
      expect(parsedHeader.kid).toBe('test-kid');
      expect(parsedHeader.typ).toBe('JWT');
    });

    it('should extract key ID from JWS', () => {
      const header = { alg: 'RS256', kid: 'test-key-id', typ: 'JWT' };
      const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const jws = `${headerB64}.payload.signature`;

      const keyId = JWSUtils.extractKeyId(jws);
      expect(keyId).toBe('test-key-id');
    });

    it('should validate JWS format', () => {
      expect(JWSUtils.isValidJWSFormat('header.payload.signature')).toBe(true);
      expect(JWSUtils.isValidJWSFormat('invalid')).toBe(false);
      expect(JWSUtils.isValidJWSFormat('only.two')).toBe(false);
      expect(JWSUtils.isValidJWSFormat('')).toBe(false);
    });

    it('should handle invalid JWS gracefully', () => {
      expect(() => JWSUtils.parseHeader('invalid')).toThrow('Invalid JWS format');
      expect(JWSUtils.extractKeyId('invalid')).toBe(null);
      expect(JWSUtils.isValidJWSFormat('invalid')).toBe(false);
    });
  });

  describe('Crypto Algorithm Compatibility', () => {
    it('should use compatible key generation parameters', async () => {
      const keyPair = await generateRSAKeyPair();

      // Verify the key pair can be used with Node.js crypto
      const crypto = require('crypto');

      // Should not throw when importing the keys
      expect(() => {
        crypto.createPublicKey(keyPair.publicKey);
        crypto.createPrivateKey(keyPair.privateKey);
      }).not.toThrow();
    });

    it('should generate keys compatible with jose library', async () => {
      const keyPair = await generateRSAKeyPair();

      // Test that the keys can be imported by the jose library
      const { importSPKI, importPKCS8 } = await import('jose');

      const publicKey = await importSPKI(keyPair.publicKey, keyPair.algorithm);
      const privateKey = await importPKCS8(keyPair.privateKey, keyPair.algorithm);

      expect(publicKey).toBeDefined();
      expect(privateKey).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should generate keys within reasonable time', async () => {
      const startTime = Date.now();

      await generateRSAKeyPair();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should generate a key pair in less than 5 seconds
      expect(duration).toBeLessThan(5000);
    }, 10000);

    it('should generate multiple key pairs efficiently', async () => {
      const startTime = Date.now();

      const keyPairs = await Promise.all([
        generateRSAKeyPair(),
        generateRSAKeyPair(),
        generateRSAKeyPair(),
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(keyPairs).toHaveLength(3);
      expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds

      // Verify all key pairs are unique
      const kids = keyPairs.map(kp => kp.kid);
      const uniqueKids = new Set(kids);
      expect(uniqueKids.size).toBe(3);
    }, 15000);
  });
});