/**
 * Generates the conformance vector bundle under `conformance/` from the
 * admin's own reference implementations (bucketing, flag evaluation, config
 * fingerprint, detached-JWS signing, bootstrap document). Every SDK
 * implementation is certified against this bundle, so nothing here may be
 * hand-computed — every expected value comes from actually invoking the
 * admin's real functions.
 *
 * Output must be byte-stable on regeneration: no live timestamps anywhere,
 * and every file is written with `JSON.stringify(value, null, '\t') + '\n'`
 * (matches Prettier's formatting, so `pnpm run format` is a no-op on it).
 *
 * Run: pnpm run generate-vectors
 */

import { sign as cryptoSign } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { importPKCS8 } from 'jose';
import {
	decodeArtifact,
	decodeIssues,
	type DecodeResult,
	isLossless,
} from '@/lib/artifact-decoder';
import { buildBootstrapDocument } from '@/lib/bootstrap';
import { assignVariant, bucketFor } from '@/lib/bucketing';
import { signDetached } from '@/lib/detached-signature';
import {
	decodeFingerprint,
	encodeFingerprint,
	enumeratePaths,
	type FingerprintEnv,
} from '@/lib/fingerprint';
import { evaluateFlag, type EvaluationContext } from '@/lib/flag-evaluation';
import type {
	Condition,
	ConditionOperator,
	ConditionType,
	ConfigArtifact,
	Environment,
	EnvironmentFlag,
	FlagType,
	FlagValue,
	FlagVariant,
	Rollout,
	Test,
} from '@/types';

const BUNDLE_VERSION = '2026-10-17.1';
const CONFORMANCE_DIR = join(process.cwd(), 'conformance');
const KEYS_DIR = join(CONFORMANCE_DIR, 'keys');

function writeJSON(fileName: string, value: unknown): void {
	writeFileSync(
		join(CONFORMANCE_DIR, fileName),
		JSON.stringify(value, null, '\t') + '\n',
	);
}

// ---------------------------------------------------------------------------
// Fixture artifact: flags, tests, rollouts
// ---------------------------------------------------------------------------

function cond(
	type: ConditionType,
	operator: ConditionOperator,
	values: string[],
): Condition {
	return { type, operator, values };
}

function conditional(
	order: number,
	value: FlagValue,
	conditions: Condition[],
): FlagVariant {
	return { type: 'conditional', order, value, conditions };
}

function testVariant(
	order: number,
	testName: string,
	values: Record<string, FlagValue>,
): FlagVariant {
	return { type: 'test', order, test: testName, values };
}

function rolloutVariant(
	order: number,
	rolloutName: string,
	value: FlagValue,
): FlagVariant {
	return { type: 'rollout', order, rollout: rolloutName, value };
}

function makeFlag(
	type: FlagType,
	defaultValue: FlagValue,
	variants: FlagVariant[] = [],
): EnvironmentFlag {
	return {
		type,
		development: { default: defaultValue },
		beta: { default: defaultValue },
		production: { default: defaultValue, variants },
	};
}

// Unlike makeFlag (variants only on production), this attaches the same
// variants to every environment — needed to exercise variant matching (not
// just default fallback) in development/beta evaluation cases.
function makeFlagAllEnvs(
	type: FlagType,
	defaultValue: FlagValue,
	variants: FlagVariant[],
): EnvironmentFlag {
	return {
		type,
		development: { default: defaultValue, variants },
		beta: { default: defaultValue, variants },
		production: { default: defaultValue, variants },
	};
}

const flags: Record<string, EnvironmentFlag> = {
	'cond/app_version_equals': makeFlag('bool', false, [
		conditional(1, true, [cond('app_version', 'equals', ['2.5.0'])]),
	]),
	'cond/app_version_not_equals': makeFlag('bool', false, [
		conditional(1, true, [cond('app_version', 'does_not_equals', ['9.9.9'])]),
	]),
	'cond/app_version_between': makeFlag('bool', false, [
		conditional(1, true, [cond('app_version', 'between', ['2.0.0', '3.0.0'])]),
	]),
	'cond/os_version_greater_than': makeFlag('bool', false, [
		conditional(1, true, [cond('os_version', 'greater_than', ['17.0'])]),
	]),
	'cond/os_version_greater_than_or_equal': makeFlag('bool', false, [
		conditional(1, true, [
			cond('os_version', 'greater_than_or_equal', ['18.0']),
		]),
	]),
	'cond/build_number_less_than': makeFlag('bool', false, [
		conditional(1, true, [cond('build_number', 'less_than', ['150'])]),
	]),
	'cond/build_number_less_than_or_equal': makeFlag('bool', false, [
		conditional(1, true, [cond('build_number', 'less_than_or_equal', ['100'])]),
	]),
	'cond/language_in': makeFlag('bool', false, [
		conditional(1, true, [cond('language', 'in', ['en', 'fr'])]),
	]),
	'cond/language_not_in': makeFlag('bool', false, [
		conditional(1, true, [cond('language', 'not_in', ['de'])]),
	]),
	'cond/platform_in': makeFlag('bool', false, [
		conditional(1, true, [cond('platform', 'in', ['ios', 'android'])]),
	]),
	'cond/platform_not_in': makeFlag('bool', false, [
		conditional(1, true, [cond('platform', 'not_in', ['android'])]),
	]),
	'cond/platform_web_only': makeFlag('bool', false, [
		conditional(1, true, [cond('platform', 'in', ['web'])]),
	]),
	'cond/device_class_in': makeFlag('bool', false, [
		conditional(1, true, [cond('device_class', 'in', ['phone', 'tablet'])]),
	]),
	'cond/device_class_not_in': makeFlag('bool', false, [
		conditional(1, true, [cond('device_class', 'not_in', ['desktop'])]),
	]),
	'cond/device_model_in': makeFlag('bool', false, [
		conditional(1, true, [cond('device_model', 'in', ['iPhone16,2'])]),
	]),
	'cond/region_in': makeFlag('bool', false, [
		conditional(1, true, [cond('region', 'in', ['US', 'CA'])]),
	]),
	'cond/region_not_in': makeFlag('bool', false, [
		conditional(1, true, [cond('region', 'not_in', ['CN'])]),
	]),
	'cond/manufacturer_custom': makeFlag('bool', false, [
		conditional(1, true, [
			cond('custom_attribute', 'custom', ['manufacturer', 'apple']),
		]),
	]),
	'cond/non_reserved_custom': makeFlag('bool', false, [
		conditional(1, true, [
			cond('custom_attribute', 'custom', ['loyalty_tier', 'gold']),
		]),
	]),
	'targeting/ordering': makeFlag('string', 'none', [
		// Deliberately out of array order: order:2 appears first, order:1 second.
		// evaluateFlag must sort by `order`, not array position, for this to
		// resolve to "platform-match" being tried before "region-match".
		conditional(2, 'region-match', [cond('region', 'in', ['US'])]),
		conditional(1, 'platform-match', [cond('platform', 'in', ['android'])]),
	]),
	// Variants attached to every environment (not just production, unlike
	// makeFlag's other fixtures) so development/beta cases exercise actual
	// variant matching rather than only the environment default.
	'targeting/env_specific': makeFlagAllEnvs('string', 'default-value', [
		conditional(1, 'matched-value', [cond('region', 'in', ['US'])]),
	]),
	// Hand-constructed: `conditions` is intentionally ABSENT (not `[]`) on this
	// conditional variant. This pins the SDK contract's vacuous-match behavior
	// (evaluateConditions/evaluateFlag both treat a missing conditions array as
	// `?? []`, which matches unconditionally). The admin's authoring-layer zod
	// guard (src/lib/validation-schemas.ts) rejects a condition-less conditional
	// variant on write, but that guard does NOT apply here — this fixture is
	// hand-built by the generator, never routed through the API, so the pinned
	// vacuous-match behavior stays reachable in the conformance bundle. See
	// task-18-report.md for why this lives at the authoring layer and not in
	// validateConfig.
	'cond/vacuous_match': makeFlag('bool', false, [
		{ type: 'conditional', order: 1, value: true },
	]),
	'test/checkout_experiment': makeFlag('string', 'no-test-default', [
		testVariant(1, 'checkout_experiment', {
			control: 'control-value',
			treatment: 'treatment-value',
		}),
	]),
	'rollout/enrolled': makeFlag('bool', false, [
		rolloutVariant(1, 'always_on_rollout', true),
	]),
	'rollout/excluded': makeFlag('bool', false, [
		rolloutVariant(1, 'always_off_rollout', true),
	]),
	'types/whole_double': makeFlag('double', 2),
	'types/whole_int': makeFlag('int', 42),
	'types/fractional_date': makeFlag('date', '2026-07-02T00:00:00.123Z'),
	'types/whole_second_date': makeFlag('date', '2026-07-02T00:00:00Z'),
	'types/json_flag': makeFlag('json', '{"sections":["home","profile"]}'),
	// C2: values decode by declared type, never by shape. Each of these looks
	// like a different type and must come back exactly as written.
	'types/bracket_string': makeFlag('string', '[Beta] Hi'),
	'types/brace_string': makeFlag('string', '{not json}'),
	'types/iso_looking_string': makeFlag('string', '2026-01-01T00:00:00Z'),
	'types/numeric_string': makeFlag('string', '42'),
	'types/json_scalar': makeFlag('json', '42'),
	// C3: groups summing to 60 leave a remainder that is not in the test, so
	// those users fall through to the next variant (order 2), not a group.
	'test/remainder_experiment': makeFlag('string', 'not-in-test', [
		testVariant(1, 'remainder_experiment', {
			alpha: 'alpha-value',
			beta: 'beta-value',
		}),
		conditional(2, 'next-variant', [cond('region', 'in', ['US'])]),
	]),
	// C3: group "without_value" has no value in this variant, so users bucketed
	// into it are not in the test either and get the environment default.
	'test/partial_values_experiment': makeFlag('string', 'not-in-test', [
		testVariant(1, 'partial_values_experiment', {
			with_value: 'with-value',
		}),
	]),
};

const tests: Record<string, Test> = {
	checkout_experiment: {
		name: 'checkout_experiment',
		type: 'test',
		salt: 'checkout-salt',
		conditions: [],
		groups: [
			{ name: 'control', percentage: 50 },
			{ name: 'treatment', percentage: 50 },
		],
	},
	remainder_experiment: {
		name: 'remainder_experiment',
		type: 'test',
		salt: 'remainder-salt',
		conditions: [],
		groups: [
			{ name: 'alpha', percentage: 30 },
			{ name: 'beta', percentage: 30 },
		],
	},
	partial_values_experiment: {
		name: 'partial_values_experiment',
		type: 'test',
		salt: 'partial-salt',
		conditions: [],
		groups: [
			{ name: 'with_value', percentage: 50 },
			{ name: 'without_value', percentage: 50 },
		],
	},
};

const rollouts: Record<string, Rollout> = {
	always_on_rollout: {
		name: 'always_on_rollout',
		type: 'rollout',
		salt: 'rollout-salt',
		conditions: [],
		percentage: 100,
	},
	always_off_rollout: {
		name: 'always_off_rollout',
		type: 'rollout',
		salt: 'rollout-salt',
		conditions: [],
		percentage: 0,
	},
};

const artifact: ConfigArtifact = {
	schema_version: 1,
	config_version: BUNDLE_VERSION,
	published_at: '2026-07-02T00:00:00.000Z',
	app_identifier: 'conformance-app',
	flags,
	tests,
	rollouts,
};

// ---------------------------------------------------------------------------
// Context matrix (SDK wire shape) + admin EvaluationContext adapter
// ---------------------------------------------------------------------------

interface WireContext {
	platform: string;
	device_class?: string;
	os_version: string;
	app_version: string;
	build_number: string;
	device_model: string;
	region?: string;
	language: string;
	reserved_attributes?: Record<string, string>;
	local_id: string;
}

const BASE_LOCAL_ID = 'AAAAAAAA-0000-4000-8000-000000000001';

const baseContext: WireContext = {
	platform: 'ios',
	device_class: 'tablet',
	os_version: '18.0',
	app_version: '2.5.0',
	build_number: '100',
	device_model: 'iPhone16,2',
	region: 'US',
	language: 'en',
	reserved_attributes: { manufacturer: 'apple' },
	local_id: BASE_LOCAL_ID,
};

const { device_class: _omitDeviceClass, ...noDeviceClassContext } = baseContext;
const { reserved_attributes: _omitReserved, ...noReservedContext } =
	baseContext;
void _omitDeviceClass;
void _omitReserved;

function toEvalContext(
	ctx: WireContext,
	environment: Environment,
): EvaluationContext {
	const { local_id, ...userAttributes } = ctx;
	return { environment, localId: local_id, userAttributes };
}

/**
 * The first canonical UUID local ID that `assignVariant` puts in `group` for
 * this test (`null` = the remainder past every group). Searching with the real
 * bucketer keeps the fixture honest: nothing about the bucket is hand-picked.
 */
function localIdInGroup(test: Test, group: string | null): string {
	for (let i = 1; i <= 10000; i++) {
		const id =
			`AAAAAAAA-0000-4000-8000-${String(i).padStart(12, '0')}`.toUpperCase();
		if (assignVariant(test.salt, id, test.groups ?? []) === group) {
			return id;
		}
	}
	throw new Error(`no local ID lands in group ${String(group)}`);
}

function withLocalId(localId: string): WireContext {
	return { ...baseContext, local_id: localId };
}

// ---------------------------------------------------------------------------
// evaluation.json
// ---------------------------------------------------------------------------

interface EvaluationCaseInput {
	flag_key: string;
	context: WireContext;
	environment: Environment;
}

const evaluationCaseInputs: EvaluationCaseInput[] = [
	{
		flag_key: 'cond/app_version_equals',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/app_version_equals',
		context: { ...baseContext, app_version: '2.6.0' },
		environment: 'production',
	},
	{
		flag_key: 'cond/app_version_not_equals',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/app_version_between',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/app_version_between',
		context: { ...baseContext, app_version: '5.0.0' },
		environment: 'production',
	},
	{
		flag_key: 'cond/os_version_greater_than',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/os_version_greater_than_or_equal',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/build_number_less_than',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/build_number_less_than_or_equal',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/language_in',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/language_not_in',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/platform_in',
		context: baseContext,
		environment: 'production',
	},
	// Android-context positive match: platform_in's ['ios', 'android'] list
	// includes android, so an android context still matches the variant.
	{
		flag_key: 'cond/platform_in',
		context: { ...baseContext, platform: 'android' },
		environment: 'production',
	},
	// Web-context positive match.
	{
		flag_key: 'cond/platform_web_only',
		context: { ...baseContext, platform: 'web' },
		environment: 'production',
	},
	{
		flag_key: 'cond/platform_not_in',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/device_class_in',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/device_class_in',
		context: noDeviceClassContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/device_class_not_in',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/device_class_not_in',
		context: noDeviceClassContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/device_model_in',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/region_in',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/region_not_in',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/manufacturer_custom',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/manufacturer_custom',
		context: {
			...baseContext,
			reserved_attributes: { manufacturer: 'android' },
		},
		environment: 'production',
	},
	{
		flag_key: 'cond/manufacturer_custom',
		context: noReservedContext,
		environment: 'production',
	},
	{
		flag_key: 'cond/non_reserved_custom',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'targeting/ordering',
		context: baseContext,
		environment: 'production',
	},
	// Vacuous-match: the fixture's conditional variant has `conditions` entirely
	// absent, which the SDK contract pins as matching unconditionally.
	{
		flag_key: 'cond/vacuous_match',
		context: baseContext,
		environment: 'production',
	},
	// Per-env variant matching, not just default fallback (development).
	{
		flag_key: 'targeting/env_specific',
		context: baseContext,
		environment: 'development',
	},
	// Per-env variant matching, not just default fallback (beta).
	{
		flag_key: 'targeting/env_specific',
		context: baseContext,
		environment: 'beta',
	},
	{
		flag_key: 'test/checkout_experiment',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'rollout/enrolled',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'rollout/excluded',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'types/whole_double',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'types/whole_int',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'types/fractional_date',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'types/json_flag',
		context: baseContext,
		environment: 'production',
	},
	...[
		'types/whole_second_date',
		'types/bracket_string',
		'types/brace_string',
		'types/iso_looking_string',
		'types/numeric_string',
		'types/json_scalar',
	].map(
		(flag_key): EvaluationCaseInput => ({
			flag_key,
			context: baseContext,
			environment: 'production',
		}),
	),
	// C3 remainder: one user per group, one past the groups' 60% total.
	...(['alpha', 'beta', null] as const).map(
		(group): EvaluationCaseInput => ({
			flag_key: 'test/remainder_experiment',
			context: withLocalId(localIdInGroup(tests.remainder_experiment, group)),
			environment: 'production',
		}),
	),
	// C3 missing group value: the assigned group exists but has no value here.
	...(['with_value', 'without_value'] as const).map(
		(group): EvaluationCaseInput => ({
			flag_key: 'test/partial_values_experiment',
			context: withLocalId(
				localIdInGroup(tests.partial_values_experiment, group),
			),
			environment: 'production',
		}),
	),
];

/**
 * Human-readable resolution source, in the same phrasing enumeratePaths uses
 * for fingerprint paths (`${env} default`, `conditional variant (order N)`,
 * `test "X" group "Y"`, `rollout "X"`) — see the Task 11 brief's evaluation.json
 * shape. Re-derives the winning test group with the same `assignVariant` the
 * evaluator itself just used; it is not an independent decision, just a label.
 */
function describeSource(
	result: ReturnType<typeof evaluateFlag>,
	environment: Environment,
	context: EvaluationContext,
	source: Pick<ConfigArtifact, 'tests'> = artifact,
): string {
	if (result.reason === 'default') {
		return `${environment} default`;
	}
	const variant = result.variant;
	if (!variant) {
		throw new Error(
			`evaluateFlag returned reason "${result.reason}" with no variant`,
		);
	}
	if (result.reason === 'conditional') {
		return `conditional variant (order ${variant.order})`;
	}
	if (result.reason === 'test') {
		const test = variant.test ? source.tests[variant.test] : undefined;
		if (!test) {
			throw new Error(`test "${String(variant.test)}" missing from fixture`);
		}
		const groupName = assignVariant(
			test.salt,
			context.localId,
			test.groups ?? [],
		);
		return `test "${variant.test}" group "${groupName}"`;
	}
	return `rollout "${variant.rollout}"`;
}

const evaluationCases = evaluationCaseInputs.map((input) => {
	const evalContext = toEvalContext(input.context, input.environment);
	const flag = flags[input.flag_key];
	if (!flag) {
		throw new Error(`unknown flag "${input.flag_key}" in evaluation fixture`);
	}
	const result = evaluateFlag(flag, input.environment, evalContext, artifact);
	return {
		context: input.context,
		flag_key: input.flag_key,
		environment: input.environment,
		expected_value: result.value,
		expected_source: describeSource(result, input.environment, evalContext),
	};
});

// ---------------------------------------------------------------------------
// fingerprint.json
// ---------------------------------------------------------------------------

const fingerprintContextInputs: Array<{
	context: WireContext;
	environment: FingerprintEnv;
}> = [
	{ context: baseContext, environment: 'production' },
	{ context: noDeviceClassContext, environment: 'production' },
	{ context: baseContext, environment: 'development' },
];

function selectionsFor(
	context: WireContext,
	environment: FingerprintEnv,
	source: ConfigArtifact = artifact,
): Record<string, number> {
	const evalContext = toEvalContext(context, environment);
	const selections: Record<string, number> = {};
	for (const [key, flag] of Object.entries(source.flags)) {
		const result = evaluateFlag(flag, environment, evalContext, source);
		const label = describeSource(result, environment, evalContext, source);
		const paths = enumeratePaths(source, flag, environment);
		const idx = paths.findIndex((p) => p.reason === label);
		if (idx < 0) {
			throw new Error(
				`selection index not found for flag "${key}" (source "${label}")`,
			);
		}
		selections[key] = idx;
	}
	return selections;
}

const fingerprintCases = fingerprintContextInputs.map(
	({ context, environment }) => ({
		context,
		environment,
		code: encodeFingerprint(
			artifact,
			environment,
			selectionsFor(context, environment),
		),
	}),
);

const decodeCases = fingerprintCases
	.slice(0, 1)
	.map(({ code, environment }) => {
		const decoded = decodeFingerprint(artifact, code);
		const expected_flags: Record<string, { value: FlagValue; reason: string }> =
			{};
		for (const [key, resolved] of Object.entries(decoded.flags)) {
			expected_flags[key] = { value: resolved.value, reason: resolved.reason };
		}
		return { code, environment, expected_flags };
	});

// ---------------------------------------------------------------------------
// signature.json
// ---------------------------------------------------------------------------

async function buildSignatureCases() {
	const privateKeyPem = readFileSync(
		join(KEYS_DIR, 'test-signing-key.pem'),
		'utf8',
	);
	const testPubPem = readFileSync(
		join(KEYS_DIR, 'test-signing-key.pub.pem'),
		'utf8',
	);
	const wrongPubPem = readFileSync(join(KEYS_DIR, 'wrong-key.pub.pem'), 'utf8');

	const configBytes = JSON.stringify(artifact);
	const configB64 = Buffer.from(configBytes, 'utf8').toString('base64');

	const privateKey = await importPKCS8(privateKeyPem, 'RS256');
	const jws = await signDetached(configBytes, privateKey, {
		alg: 'RS256',
		kid: 'conformance-key',
	});

	// Flip one base64 character so the decoded bytes differ from what `jws`
	// was actually signed over, without touching padding.
	const tamperIndex = Math.floor(configB64.length / 2);
	const tamperChar = configB64[tamperIndex] === 'A' ? 'B' : 'A';
	const tamperedConfigB64 =
		configB64.slice(0, tamperIndex) +
		tamperChar +
		configB64.slice(tamperIndex + 1);

	// strict_header_rejection: hand-built JWS whose protected header omits
	// `crit` (signDetached always adds crit:["b64"], so it can't produce this).
	const strictHeader = { alg: 'RS256', kid: 'conformance-key', b64: false };
	const strictHeaderB64 = Buffer.from(
		JSON.stringify(strictHeader),
		'utf8',
	).toString('base64url');
	const signingInput = Buffer.concat([
		Buffer.from(strictHeaderB64, 'ascii'),
		Buffer.from('.'),
		Buffer.from(configBytes, 'utf8'),
	]);
	const strictSig = cryptoSign('RSA-SHA256', signingInput, privateKeyPem);
	const strictJws = `${strictHeaderB64}..${strictSig.toString('base64url')}`;

	return [
		{
			kind: 'valid',
			config_b64: configB64,
			jws,
			verify_kid: 'conformance-key',
			verify_pem: testPubPem,
			expect_valid: true,
		},
		{
			kind: 'tampered',
			config_b64: tamperedConfigB64,
			jws,
			verify_kid: 'conformance-key',
			verify_pem: testPubPem,
			expect_valid: false,
		},
		{
			kind: 'wrong_kid',
			config_b64: configB64,
			jws,
			verify_kid: 'not-the-signing-kid',
			verify_pem: testPubPem,
			expect_valid: false,
		},
		{
			kind: 'wrong_key',
			config_b64: configB64,
			jws,
			verify_kid: 'conformance-key',
			verify_pem: wrongPubPem,
			expect_valid: false,
		},
		{
			kind: 'strict_header_rejection',
			config_b64: configB64,
			jws: strictJws,
			verify_kid: 'conformance-key',
			verify_pem: testPubPem,
			expect_valid: false,
		},
	];
}

// ---------------------------------------------------------------------------
// bootstrap.json
// ---------------------------------------------------------------------------

function buildBootstrapCases() {
	const testPubPem = readFileSync(
		join(KEYS_DIR, 'test-signing-key.pub.pem'),
		'utf8',
	);

	const validDocument = buildBootstrapDocument({
		appIdentifier: 'conformance-app',
		endpointUrl: 'https://cdn.example.com/conformance/config.json',
		publicKeys: [{ kid: 'conformance-key', pem: testPubPem }],
		fetchPolicy: null,
	});

	// Rotation-safe bootstrap: the active key first, then a standby key the app
	// also trusts. SDKs must keep every key, in order.
	const wrongPubPem = readFileSync(join(KEYS_DIR, 'wrong-key.pub.pem'), 'utf8');
	const multiKeyDocument = buildBootstrapDocument({
		appIdentifier: 'conformance-app',
		endpointUrl: 'https://cdn.example.com/conformance/config.json',
		publicKeys: [
			{ kid: 'conformance-key', pem: testPubPem },
			{ kid: 'conformance-standby-key', pem: wrongPubPem },
		],
		fetchPolicy: null,
	});

	return [
		{ name: 'valid', valid: true, document: validDocument, reason: '' },
		{
			name: 'valid_multi_key',
			valid: true,
			document: multiKeyDocument,
			reason: '',
			expected_kids: ['conformance-key', 'conformance-standby-key'],
		},
		{
			name: 'missing_endpoint',
			valid: false,
			document: {
				app_identifier: 'x',
				public_keys: [],
				fetch_policy: { min_interval_seconds: 21600, hard_ttl_days: 7 },
			},
			reason: 'endpoint_url missing',
		},
		{
			name: 'endpoint_not_config_json',
			valid: false,
			document: {
				app_identifier: 'x',
				endpoint_url: 'https://cdn.example.com/manifest.txt',
				public_keys: [],
				fetch_policy: { min_interval_seconds: 21600, hard_ttl_days: 7 },
			},
			reason: 'endpoint_url must end with config.json',
		},
	];
}

// ---------------------------------------------------------------------------
// decoding.json
// ---------------------------------------------------------------------------

// Hand-built wire artifacts: the admin never publishes most of this (publish
// validation refuses it), but SDKs must still decode it per the v1 contract in
// src/lib/artifact-decoder.ts. Expected outcomes come from that decoder and the
// reference evaluator, never from hand-written answers.

const header = {
	schema_version: 1,
	config_version: BUNDLE_VERSION,
	published_at: '2026-07-02T00:00:00.000Z',
	app_identifier: 'conformance-app',
};

/** A flag whose three environments share one default and variant list. */
function rawFlag(
	type: string,
	defaultValue: unknown,
	variants: unknown[] = [],
	extra: Record<string, unknown> = {},
): Record<string, unknown> {
	const env = { default: defaultValue, variants };
	return {
		type,
		...extra,
		development: env,
		beta: env,
		production: env,
	};
}

// A string value swapped for raw text after JSON.stringify, for number
// spellings it can't emit (it always writes 2.0 as 2).
const RAW_TWO_POINT_ZERO = '__RAW_2_0__';

const tolerantArtifact = {
	...header,
	// Unknown keys are ignored at every level.
	future_top_level_field: { anything: true },
	flags: {
		'ok/bool': rawFlag(
			'bool',
			false,
			[
				{
					type: 'conditional',
					order: 1,
					value: true,
					conditions: [{ type: 'platform', operator: 'in', values: ['ios'] }],
				},
			],
			{ owner: 'team-a' },
		),
		'ok/rollout': rawFlag('bool', false, [
			{ type: 'rollout', order: 1, rollout: 'fine_rollout', value: true },
		]),

		// C1: each of these flags is skipped; the rest of the artifact survives.
		'skip/unknown_type': rawFlag('color', 'red'),
		'skip/missing_environment': {
			type: 'bool',
			development: { default: false },
			production: { default: false },
		},
		'skip/default_wrong_type': rawFlag('int', '5'),
		'skip/json_raw_object': rawFlag('json', { sections: ['home'] }),
		'skip/date_only': rawFlag('date', '2026-07-02'),
		'skip/date_with_offset': rawFlag('date', '2026-07-02T00:00:00+01:00'),
		'skip/int_fractional': rawFlag('int', 2.5),
		'skip/null_default': rawFlag('string', null),
		'skip/variants_not_array': {
			type: 'bool',
			development: { default: false, variants: {} },
			beta: { default: false },
			production: { default: false },
		},
		'skip/not_an_object': 'bool',

		// C2: typed decoding by declared type.
		'typed/int_written_as_float': rawFlag('int', RAW_TWO_POINT_ZERO),
		'typed/double_written_as_int': rawFlag('double', 3),
		'typed/bracket_string': rawFlag('string', '[Beta] Hi'),
		'typed/iso_looking_string': rawFlag('string', '2026-01-01T00:00:00Z'),
		'typed/json_scalar': rawFlag('json', '42'),
		'typed/json_leading_newline': rawFlag('json', '\n{"a":1}'),
		'typed/date_fractional': rawFlag('date', '2026-07-02T10:00:04.796Z'),
		'typed/date_whole_seconds': rawFlag('date', '2026-07-02T10:00:04Z'),

		// C1: bad variants become never-matching placeholders (one fingerprint
		// path each), a variant without an order is dropped, and conditions an
		// SDK doesn't understand never match. Only order 9 can match.
		'variants/placeholders': rawFlag('string', 'default', [
			{ type: 'geo_fence', order: 1, value: 'unknown-variant-type' },
			{
				type: 'conditional',
				order: 2,
				value: 5,
				conditions: [{ type: 'platform', operator: 'in', values: ['ios'] }],
			},
			{ type: 'conditional', value: 'no-order' },
			{
				type: 'conditional',
				order: 3,
				value: 'unknown-condition-type',
				conditions: [{ type: 'moon_phase', operator: 'in', values: ['full'] }],
			},
			{
				type: 'conditional',
				order: 4,
				value: 'unknown-operator',
				conditions: [
					{ type: 'platform', operator: 'matches_regex', values: ['ios'] },
				],
			},
			{
				type: 'conditional',
				order: 5,
				value: 'numeric-condition-values',
				conditions: [
					{ type: 'build_number', operator: 'equals', values: [100] },
				],
			},
			{ type: 'test', order: 6, test: 'dropped_test', values: { a: 't' } },
			{ type: 'rollout', order: 7, rollout: 'dropped_rollout', value: 'r' },
			{ type: 'rollout', order: 8, value: 'missing-rollout-reference' },
			{
				type: 'conditional',
				order: 9,
				value: 'first-real-match',
				conditions: [{ type: 'platform', operator: 'in', values: ['ios'] }],
			},
		]),
		// An unknown operator fails closed even where an evaluator might ignore
		// the operator (custom_attribute only reads its values).
		'variants/custom_attribute_unknown_operator': rawFlag('bool', false, [
			{
				type: 'conditional',
				order: 1,
				value: true,
				conditions: [
					{
						type: 'custom_attribute',
						operator: 'regex',
						values: ['manufacturer', 'apple'],
					},
				],
			},
		]),
		'variants/test_remainder': rawFlag('string', 'not-in-test', [
			{
				type: 'test',
				order: 1,
				test: 'small_test',
				values: { only: 'in-test' },
			},
		]),
		'variants/test_unknown_precondition': rawFlag('string', 'not-in-test', [
			{
				type: 'test',
				order: 1,
				test: 'unknown_precondition_test',
				values: { everyone: 'in-test' },
			},
		]),
	},
	tests: {
		small_test: {
			name: 'small_test',
			type: 'test',
			salt: 'small-salt',
			conditions: [],
			groups: [{ name: 'only', percentage: 10 }],
		},
		unknown_precondition_test: {
			name: 'unknown_precondition_test',
			type: 'test',
			salt: 'precondition-salt',
			conditions: [{ type: 'moon_phase', operator: 'in', values: ['full'] }],
			groups: [{ name: 'everyone', percentage: 100 }],
		},
		dropped_test: {
			name: 'dropped_test',
			type: 'test',
			salt: 'dropped-salt',
			conditions: [],
			groups: [
				{ name: 'a', percentage: 60 },
				{ name: 'b', percentage: 60 },
			],
		},
		fractional_test: {
			name: 'fractional_test',
			type: 'test',
			salt: 'fractional-salt',
			conditions: [],
			groups: [{ name: 'a', percentage: 12.5 }],
		},
	},
	rollouts: {
		fine_rollout: {
			name: 'fine_rollout',
			type: 'rollout',
			salt: 'fine-salt',
			conditions: [],
			percentage: 100,
		},
		dropped_rollout: {
			name: 'dropped_rollout',
			type: 'rollout',
			salt: 'dropped-salt',
			conditions: [],
			percentage: 150,
		},
		fractional_rollout: {
			name: 'fractional_rollout',
			type: 'rollout',
			salt: 'fractional-salt',
			conditions: [],
			percentage: 12.5,
		},
	},
};

const tolerantText = JSON.stringify(tolerantArtifact).replaceAll(
	JSON.stringify(RAW_TWO_POINT_ZERO),
	'2.0',
);

const decodingInputs: Array<{ name: string; text: string }> = [
	{ name: 'tolerant', text: tolerantText },
	{
		name: 'minimal_without_tests_or_rollouts',
		text: JSON.stringify({ ...header, flags: {} }),
	},
	{
		name: 'rejected_invalid_json',
		text: JSON.stringify({ ...header, flags: {} }).slice(0, -2),
	},
	{
		name: 'rejected_unsupported_schema_version',
		text: JSON.stringify({ ...header, schema_version: 2, flags: {} }),
	},
	{
		name: 'rejected_missing_flags',
		text: JSON.stringify({ ...header }),
	},
	{
		name: 'rejected_tests_not_object',
		text: JSON.stringify({ ...header, flags: {}, tests: [] }),
	},
	{
		name: 'rejected_published_at_not_instant',
		text: JSON.stringify({ ...header, published_at: '2026-07-02', flags: {} }),
	},
];

/** The decoded shape SDK runners compare against their own decoded models. */
function summarizeDecoded(result: DecodeResult) {
	if (!result.accepted || !result.artifact) {
		return { accepted: false, reason: result.rejection ?? '' };
	}
	const decoded = result.artifact;
	const flagSummaries: Record<string, unknown> = {};
	for (const key of Object.keys(decoded.flags).sort()) {
		const flag = decoded.flags[key];
		const environments: Record<string, unknown> = {};
		for (const env of ['development', 'beta', 'production'] as const) {
			environments[env] = {
				default: flag[env].default,
				variants: (flag[env].variants ?? []).map((variant) => ({
					order: variant.order,
					kind: variant.type,
				})),
			};
		}
		flagSummaries[key] = { type: flag.type, environments };
	}
	return {
		accepted: true,
		flags: flagSummaries,
		skipped_flags: result.skippedFlags
			.map((issue) => /^flags\["(.+?)"\]/.exec(issue.path)?.[1] ?? issue.path)
			.sort(),
		tests: Object.keys(decoded.tests).sort(),
		rollouts: Object.keys(decoded.rollouts).sort(),
	};
}

function buildDecodingCases() {
	return decodingInputs.map(({ name, text }) => {
		const result = decodeArtifact(text);
		const base = {
			name,
			artifact_b64: Buffer.from(text, 'utf8').toString('base64'),
			expected: summarizeDecoded(result),
		};
		if (!result.accepted || !result.artifact) {
			return base;
		}
		const decoded = result.artifact;

		const smallTest = decoded.tests.small_test as Test | undefined;
		const evaluationInputs: EvaluationCaseInput[] = [];
		for (const flag_key of Object.keys(decoded.flags).sort()) {
			evaluationInputs.push({
				flag_key,
				context: baseContext,
				environment: 'production',
			});
		}
		if (smallTest) {
			evaluationInputs.push(
				...(['only', null] as const).map(
					(group): EvaluationCaseInput => ({
						flag_key: 'variants/test_remainder',
						context: withLocalId(localIdInGroup(smallTest, group)),
						environment: 'production',
					}),
				),
			);
		}

		const evaluations = evaluationInputs.map((input) => {
			const evalContext = toEvalContext(input.context, input.environment);
			const result = evaluateFlag(
				decoded.flags[input.flag_key],
				input.environment,
				evalContext,
				decoded,
			);
			return {
				context: input.context,
				flag_key: input.flag_key,
				environment: input.environment,
				expected_value: result.value,
				expected_source: describeSource(
					result,
					input.environment,
					evalContext,
					decoded,
				),
			};
		});

		const fingerprint = {
			context: baseContext,
			environment: 'production' as FingerprintEnv,
			code: encodeFingerprint(
				decoded,
				'production',
				selectionsFor(baseContext, 'production', decoded),
			),
		};

		return { ...base, evaluations, fingerprint };
	});
}

// ---------------------------------------------------------------------------
// bucketing.json
// ---------------------------------------------------------------------------

function buildBucketingCases() {
	const cases: Array<{
		salt: string;
		identifier: string;
		bucket: number;
		swift_applicable: boolean;
	}> = [];

	for (let i = 1; i <= 120; i++) {
		const salt = i <= 60 ? 'salt-alpha' : 'salt-beta';
		const identifier =
			`AAAAAAAA-0000-4000-8000-${String(i).padStart(12, '0')}`.toUpperCase();
		cases.push({
			salt,
			identifier,
			bucket: bucketFor(salt, identifier),
			swift_applicable: true,
		});
	}

	const edgeCases: Array<{ salt: string; identifier: string }> = [
		{ salt: 's', identifier: '' },
		{ salt: 's', identifier: 'café-⚡-user' },
		{ salt: 'test-salt', identifier: 'user-123' },
		{ salt: 'test-salt', identifier: 'user-456' },
	];
	for (const { salt, identifier } of edgeCases) {
		cases.push({
			salt,
			identifier,
			bucket: bucketFor(salt, identifier),
			swift_applicable: false,
		});
	}

	return cases;
}

// ---------------------------------------------------------------------------
// Assemble + write
// ---------------------------------------------------------------------------

async function main() {
	if (!existsSync(CONFORMANCE_DIR)) {
		mkdirSync(CONFORMANCE_DIR, { recursive: true });
	}

	// The main fixture must survive SDK decoding untouched, or every other set
	// would be certifying against an artifact SDKs see differently.
	const fixtureDecode = decodeArtifact(JSON.stringify(artifact));
	if (!isLossless(fixtureDecode)) {
		throw new Error(
			`fixture artifact is not lossless under the SDK decoder: ${JSON.stringify(decodeIssues(fixtureDecode))}`,
		);
	}

	const bucketingCases = buildBucketingCases();
	writeJSON('bucketing.json', {
		version: BUNDLE_VERSION,
		note: 'Runners MUST execute every case whose swift_applicable is not false. Cases flagged swift_applicable:false use non-UUID identifiers only the string-hashing reference (admin) exercises.',
		cases: bucketingCases,
	});

	writeJSON('evaluation.json', {
		version: BUNDLE_VERSION,
		artifact,
		cases: evaluationCases,
	});

	writeJSON('fingerprint.json', {
		version: BUNDLE_VERSION,
		artifact,
		cases: fingerprintCases,
		decode_cases: decodeCases,
	});

	const signatureCases = await buildSignatureCases();
	writeJSON('signature.json', {
		version: BUNDLE_VERSION,
		cases: signatureCases,
	});

	const bootstrapCases = buildBootstrapCases();
	writeJSON('bootstrap.json', {
		version: BUNDLE_VERSION,
		cases: bootstrapCases,
	});

	const decodingCases = buildDecodingCases();
	writeJSON('decoding.json', {
		version: BUNDLE_VERSION,
		note: 'artifact_b64 is the exact config.json text. Decode it with the SDK decoder, compare the decoded model to expected (values compared by the flag type: dates as instants, numbers numerically), then run evaluations and the fingerprint against the decoded artifact.',
		cases: decodingCases,
	});

	writeJSON('manifest.json', {
		version: BUNDLE_VERSION,
		sets: {
			bucketing: { file: 'bucketing.json', count: bucketingCases.length },
			evaluation: { file: 'evaluation.json', count: evaluationCases.length },
			fingerprint: { file: 'fingerprint.json', count: fingerprintCases.length },
			signature: { file: 'signature.json', count: signatureCases.length },
			bootstrap: { file: 'bootstrap.json', count: bootstrapCases.length },
			decoding: { file: 'decoding.json', count: decodingCases.length },
		},
	});
}

// Guard against running (and writing the bundle) when this module is merely
// imported, not executed directly. Nothing currently imports from this file,
// but matches the precedent in scripts/migrate-flags-to-v2.ts and friends —
// and scripts/migrate-platform-values.ts learned this the hard way (see its
// matching guard) when a test imported one of its helpers.
if (require.main === module) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
