/**
 * JSON Spec Validation Test
 *
 * Simple test to validate our JSON Spec compliance functions work correctly
 * without complex database setup or mocking.
 */

const { bucketFor } = require('../../src/lib/bucketing');
const { validateIdentifierKey, normalizeToIdentifierKey } = require('../../src/lib/validation');

describe('JSON Spec Functions', () => {
  describe('Bucketing Algorithm', () => {
    test('produces consistent results for same input', async () => {
      const salt = 'test-salt-123';
      const localId = '550e8400-e29b-41d4-a716-446655440000';

      const result1 = await bucketFor(salt, localId);
      const result2 = await bucketFor(salt, localId);

      expect(result1).toBe(result2);
      expect(result1).toBeGreaterThanOrEqual(1);
      expect(result1).toBeLessThanOrEqual(100);
    });

    test('produces different results for different inputs', async () => {
      const salt = 'test-salt-123';
      const id1 = '550e8400-e29b-41d4-a716-446655440000';
      const id2 = '123e4567-e89b-12d3-a456-426614174000';

      const result1 = await bucketFor(salt, id1);
      const result2 = await bucketFor(salt, id2);

      expect(result1).not.toBe(result2);
    });

    test('handles edge cases', async () => {
      // Empty salt (should work but produce different results)
      const result1 = await bucketFor('', 'test-id');
      expect(result1).toBeGreaterThanOrEqual(1);
      expect(result1).toBeLessThanOrEqual(100);

      // Unicode characters
      const result2 = await bucketFor('test-🚀-salt', 'test-id');
      expect(result2).toBeGreaterThanOrEqual(1);
      expect(result2).toBeLessThanOrEqual(100);
    });
  });

  describe('Key Validation', () => {
    test('validates valid keys', () => {
      expect(validateIdentifierKey('valid_key')).toEqual({ valid: true });
      expect(validateIdentifierKey('store_use_new_feature')).toEqual({ valid: true });
      expect(validateIdentifierKey('ab')).toEqual({ valid: true }); // minimum 2 characters
    });

    test('rejects invalid keys', () => {
      expect(validateIdentifierKey('Invalid-Key')).toEqual({
        valid: false,
        error: expect.stringContaining('lowercase letters')
      });
      expect(validateIdentifierKey('123invalid')).toEqual({
        valid: false,
        error: expect.stringContaining('lowercase letters') // numbers not allowed
      });
      expect(validateIdentifierKey('_invalid')).toEqual({
        valid: false,
        error: expect.stringContaining('start')
      });
      expect(validateIdentifierKey('invalid_')).toEqual({
        valid: false,
        error: expect.stringContaining('end')
      });
      expect(validateIdentifierKey('a')).toEqual({
        valid: false,
        error: expect.stringContaining('2 characters')
      });
    });

    test('enforces 64 character limit', () => {
      const longKey = 'a'.repeat(65);
      expect(validateIdentifierKey(longKey)).toEqual({
        valid: false,
        error: expect.stringContaining('64')
      });
    });
  });

  describe('Key Normalization', () => {
    test('normalizes display names to valid keys', () => {
      expect(normalizeToIdentifierKey('Store: Use New Feature')).toBe('store_use_new_feature');
      expect(normalizeToIdentifierKey('My Great Feature!')).toBe('my_great_feature');
      expect(normalizeToIdentifierKey('test-feature')).toBe('test_feature');
    });

    test('handles edge cases', () => {
      expect(normalizeToIdentifierKey('123 Feature')).toBe('feature');
      expect(normalizeToIdentifierKey('!@#$%')).toBe('');
      expect(normalizeToIdentifierKey('UPPER case')).toBe('upper_case');
    });
  });
});