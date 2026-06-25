/**
 * Config fingerprint codes.
 *
 * A fingerprint code captures the exact resolved flag configuration a single
 * client has for a published config version. Format:
 *
 *   <config_version>.<HEX>
 *
 * The hex is a byte-aligned bitstream, packed MSB-first:
 *
 *   fmt      4 bits   fingerprint format version (currently 1)
 *   env      2 bits   0=development, 1=beta, 2=production
 *   per-flag         ceil(log2(pathCount)) bits per flag, flags sorted by key
 *   (pad to whole bytes with zero bits)
 *   crc      8 bits   CRC-8 (poly 0x07, init 0x00) over the padded payload bytes
 *
 * Per-flag "paths" are the terminal resolution outcomes for a flag in an
 * environment, enumerated deterministically from the artifact so encoder and
 * decoder agree:
 *
 *   paths[0]   = environment default
 *   paths[1..] = each variant in `order` ascending:
 *                  conditional → 1 path
 *                  test        → 1 path per group of the referenced test
 *                                (artifact.tests[name].groups order)
 *                  rollout     → 1 path
 *
 * See docs/config-fingerprint-spec.md for the full contract.
 */

import type {
	ConfigArtifact,
	EnvironmentFlag,
	FlagType,
	FlagValue,
} from '@/types/core';

export const FINGERPRINT_FORMAT = 1;

/** env index → name. Order is load-bearing; do not reorder. */
export const ENV_NAMES = ['development', 'beta', 'production'] as const;
export type FingerprintEnv = (typeof ENV_NAMES)[number];

export interface ResolvedFlag {
	type: FlagType;
	value: FlagValue;
	/** Why the flag resolved to this value (which default/variant/test/rollout). */
	reason: string;
}

export interface DecodedFingerprint {
	env: FingerprintEnv;
	flags: Record<string, ResolvedFlag>;
}

export class FingerprintError extends Error {}

/** Number of bits needed to index `count` paths. A single-path flag costs 0 bits. */
export function bitWidth(count: number): number {
	return count <= 1 ? 0 : Math.ceil(Math.log2(count));
}

/** CRC-8, polynomial 0x07, init 0x00 (a.k.a. CRC-8/SMBUS). */
export function crc8(bytes: number[]): number {
	let crc = 0;
	for (const byte of bytes) {
		crc ^= byte & 0xff;
		for (let i = 0; i < 8; i++) {
			crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
		}
	}
	return crc;
}

interface FlagPath {
	value: FlagValue;
	reason: string;
}

/**
 * Enumerate the terminal resolution paths for a flag in an environment.
 * Both encoder and decoder must produce the identical list.
 */
export function enumeratePaths(
	artifact: ConfigArtifact,
	flag: EnvironmentFlag,
	env: FingerprintEnv,
): FlagPath[] {
	const cfg = flag[env];
	const paths: FlagPath[] = [{ value: cfg.default, reason: `${env} default` }];

	const variants = [...(cfg.variants ?? [])].sort((a, b) => a.order - b.order);
	for (const variant of variants) {
		if (variant.type === 'conditional') {
			paths.push({
				value: variant.value as FlagValue,
				reason: `conditional variant (order ${variant.order})`,
			});
		} else if (variant.type === 'test') {
			const test = variant.test ? artifact.tests[variant.test] : undefined;
			for (const group of test?.groups ?? []) {
				paths.push({
					value: variant.values?.[group.name] as FlagValue,
					reason: `test "${variant.test}" group "${group.name}"`,
				});
			}
		} else {
			paths.push({
				value: variant.value as FlagValue,
				reason: `rollout "${variant.rollout}"`,
			});
		}
	}
	return paths;
}

const sortedFlagKeys = (artifact: ConfigArtifact): string[] =>
	Object.keys(artifact.flags).sort();

class BitWriter {
	private bits: number[] = [];

	write(value: number, width: number): void {
		for (let i = width - 1; i >= 0; i--) {
			this.bits.push((value >> i) & 1);
		}
	}

	toBytes(): number[] {
		const out: number[] = [];
		for (let i = 0; i < this.bits.length; i += 8) {
			let b = 0;
			for (let j = 0; j < 8; j++) {
				b = (b << 1) | (this.bits[i + j] ?? 0);
			}
			out.push(b);
		}
		return out;
	}
}

class BitReader {
	private bits: number[] = [];
	private pos = 0;

	constructor(bytes: number[]) {
		for (const b of bytes) {
			for (let j = 7; j >= 0; j--) {
				this.bits.push((b >> j) & 1);
			}
		}
	}

	read(width: number): number {
		if (width === 0) {
			return 0;
		}
		if (this.pos + width > this.bits.length) {
			throw new FingerprintError(
				'fingerprint payload is shorter than the artifact requires',
			);
		}
		let v = 0;
		for (let i = 0; i < width; i++) {
			v = (v << 1) | this.bits[this.pos++];
		}
		return v;
	}

	/** Bits not yet consumed (the trailing zero padding before the CRC byte). */
	remaining(): number {
		return this.bits.length - this.pos;
	}
}

/**
 * Encode a fingerprint. `selections` maps flag key → winning path index
 * (as the SDK evaluator would record it). Primarily used for tests and as the
 * canonical reference implementation; the SDK is the production producer.
 */
export function encodeFingerprint(
	artifact: ConfigArtifact,
	env: FingerprintEnv,
	selections: Record<string, number>,
): string {
	const writer = new BitWriter();
	writer.write(FINGERPRINT_FORMAT, 4);
	writer.write(ENV_NAMES.indexOf(env), 2);
	for (const key of sortedFlagKeys(artifact)) {
		const paths = enumeratePaths(artifact, artifact.flags[key], env);
		writer.write(selections[key] ?? 0, bitWidth(paths.length));
	}
	const payload = writer.toBytes();
	const bytes = [...payload, crc8(payload)];
	const hex = bytes
		.map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
		.join('');
	return `${artifact.config_version}.${hex}`;
}

/** Split a code into its config version and hex payload. */
export function splitFingerprint(code: string): {
	version: string;
	hex: string;
} {
	const trimmed = code.trim();
	const dot = trimmed.lastIndexOf('.');
	if (dot <= 0 || dot === trimmed.length - 1) {
		throw new FingerprintError(
			'invalid fingerprint: expected "<version>.<HEX>"',
		);
	}
	return { version: trimmed.slice(0, dot), hex: trimmed.slice(dot + 1) };
}

/**
 * Decode a fingerprint against the artifact for its version. Throws
 * FingerprintError on any mismatch (version, format, CRC, length).
 */
export function decodeFingerprint(
	artifact: ConfigArtifact,
	code: string,
): DecodedFingerprint {
	const { version, hex } = splitFingerprint(code);
	if (version !== artifact.config_version) {
		throw new FingerprintError(
			`version mismatch: code is for "${version}" but artifact is "${artifact.config_version}"`,
		);
	}
	if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
		throw new FingerprintError('invalid fingerprint: hex payload is malformed');
	}

	const bytes: number[] = [];
	for (let i = 0; i < hex.length; i += 2) {
		bytes.push(parseInt(hex.slice(i, i + 2), 16));
	}
	if (bytes.length < 2) {
		throw new FingerprintError('fingerprint payload is too short');
	}

	const crc = bytes.pop() as number;
	if (crc8(bytes) !== crc) {
		throw new FingerprintError(
			'checksum mismatch — the code is corrupt or mistyped',
		);
	}

	const reader = new BitReader(bytes);
	const fmt = reader.read(4);
	if (fmt !== FINGERPRINT_FORMAT) {
		throw new FingerprintError(`unsupported fingerprint format: ${fmt}`);
	}
	const env = ENV_NAMES[reader.read(2)] as FingerprintEnv | undefined;
	if (!env) {
		throw new FingerprintError('invalid environment in fingerprint');
	}

	const flags: Record<string, ResolvedFlag> = {};
	for (const key of sortedFlagKeys(artifact)) {
		const flag = artifact.flags[key];
		const paths = enumeratePaths(artifact, flag, env);
		const idx = reader.read(bitWidth(paths.length));
		const path = paths[idx] as FlagPath | undefined;
		if (!path) {
			throw new FingerprintError(`selector out of range for flag "${key}"`);
		}
		flags[key] = { type: flag.type, value: path.value, reason: path.reason };
	}

	// Anything left beyond the final byte's zero padding means the code does not
	// match this artifact's flag layout.
	if (reader.remaining() >= 8) {
		throw new FingerprintError(
			'fingerprint payload is longer than the artifact requires',
		);
	}

	return { env, flags };
}
