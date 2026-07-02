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

const BUNDLE_VERSION = '2026-07-02.1';
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
	'types/fractional_date': makeFlag('date', '2026-07-02T00:00:00.123Z'),
	'types/json_flag': makeFlag('json', '{"sections":["home","profile"]}'),
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
		flag_key: 'types/fractional_date',
		context: baseContext,
		environment: 'production',
	},
	{
		flag_key: 'types/json_flag',
		context: baseContext,
		environment: 'production',
	},
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
		const test = variant.test ? tests[variant.test] : undefined;
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
): Record<string, number> {
	const evalContext = toEvalContext(context, environment);
	const selections: Record<string, number> = {};
	for (const [key, flag] of Object.entries(flags)) {
		const result = evaluateFlag(flag, environment, evalContext, artifact);
		const source = describeSource(result, environment, evalContext);
		const paths = enumeratePaths(artifact, flag, environment);
		const idx = paths.findIndex((p) => p.reason === source);
		if (idx < 0) {
			throw new Error(
				`selection index not found for flag "${key}" (source "${source}")`,
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

	return [
		{ name: 'valid', valid: true, document: validDocument, reason: '' },
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

	writeJSON('manifest.json', {
		version: BUNDLE_VERSION,
		sets: {
			bucketing: { file: 'bucketing.json', count: bucketingCases.length },
			evaluation: { file: 'evaluation.json', count: evaluationCases.length },
			fingerprint: { file: 'fingerprint.json', count: fingerprintCases.length },
			signature: { file: 'signature.json', count: signatureCases.length },
			bootstrap: { file: 'bootstrap.json', count: bootstrapCases.length },
		},
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
