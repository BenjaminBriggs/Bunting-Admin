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
 * @returns Bucket number from 1 to 100
 */
export function bucketFor(salt: string, localId: string): number {
	// Combine salt and local ID for hashing
	const input = `${salt}:${localId}`;

	// Create SHA256 hash
	const hash = createHash('sha256').update(input, 'utf8').digest('hex');

	// Take the first 8 bytes (16 hex chars) as a big-endian unsigned 64-bit
	// integer, matching the SDK (Bucketing.swift) and ../docs/concepts.md
	// §Deterministic Bucketing. A 32-bit read here diverges from the SDK for
	// ~99% of users.
	const value = BigInt(`0x${hash.substring(0, 16)}`);

	// Map to 1-100 range using modulo
	// Add 1 to ensure range is 1-100 instead of 0-99
	const bucket = Number(value % 100n) + 1;

	return bucket;
}

/**
 * Checks if a user should be included in a percentage-based rollout.
 *
 * @param salt - Unique salt for this rollout
 * @param localId - User's device/session identifier
 * @param percentage - Target percentage (0-100)
 * @returns True if user is in the rollout
 */
export function isInRollout(
	salt: string,
	localId: string,
	percentage: number,
): boolean {
	if (percentage <= 0) {
		return false;
	}
	if (percentage >= 100) {
		return true;
	}

	const bucket = bucketFor(salt, localId);
	return bucket <= percentage;
}

/**
 * Assigns a user to a specific variant in an A/B test.
 *
 * @param salt - Unique salt for this test
 * @param localId - User's device/session identifier
 * @param variants - Array of variant configurations with percentages
 * @returns Assigned variant name or null if not in test
 */
export function assignVariant(
	salt: string,
	localId: string,
	variants: Array<{ name: string; percentage: number }>,
): string | null {
	const bucket = bucketFor(salt, localId);

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
