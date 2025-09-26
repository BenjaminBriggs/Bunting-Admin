/**
 * Deterministic User Bucketing Algorithm
 *
 * Implements SHA256-based user bucketing for consistent test/rollout assignment.
 * Based on Bunting SDK specification for deterministic percentage-based bucketing.
 */

import { createHash } from 'crypto';

/**
 * Deterministically assigns a user to a bucket (1-100) based on salt and local ID.
 *
 * @param salt - Unique salt for this test/rollout (ensures different distributions)
 * @param localId - User's device/session identifier (UUID format preferred)
 * @returns Promise<number> - Bucket number from 1 to 100
 */
export async function bucketFor(salt: string, localId: string): Promise<number> {
  // Combine salt and local ID for hashing
  const input = `${salt}:${localId}`;

  // Create SHA256 hash
  const hash = createHash('sha256').update(input, 'utf8').digest('hex');

  // Take first 8 characters (32 bits) and convert to integer
  const hashInt = parseInt(hash.substring(0, 8), 16);

  // Map to 1-100 range using modulo
  // Add 1 to ensure range is 1-100 instead of 0-99
  const bucket = (hashInt % 100) + 1;

  return bucket;
}

/**
 * Checks if a user should be included in a percentage-based rollout.
 *
 * @param salt - Unique salt for this rollout
 * @param localId - User's device/session identifier
 * @param percentage - Target percentage (0-100)
 * @returns Promise<boolean> - True if user is in the rollout
 */
export async function isInRollout(salt: string, localId: string, percentage: number): Promise<boolean> {
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;

  const bucket = await bucketFor(salt, localId);
  return bucket <= percentage;
}

/**
 * Assigns a user to a specific variant in an A/B test.
 *
 * @param salt - Unique salt for this test
 * @param localId - User's device/session identifier
 * @param variants - Array of variant configurations with percentages
 * @returns Promise<string | null> - Assigned variant name or null if not in test
 */
export async function assignVariant(
  salt: string,
  localId: string,
  variants: Array<{ name: string; percentage: number }>
): Promise<string | null> {
  const bucket = await bucketFor(salt, localId);

  let cumulativePercentage = 0;
  for (const variant of variants) {
    cumulativePercentage += variant.percentage;
    if (bucket <= cumulativePercentage) {
      return variant.name;
    }
  }

  // User not in any variant (total percentage < 100)
  return null;
}