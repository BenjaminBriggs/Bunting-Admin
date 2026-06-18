import { NextResponse } from 'next/server';
import { z } from 'zod';

// Runtime request validation for the core CRUD routes.
//
// These schemas are the single source of truth for what the API *accepts* on
// the wire. They intentionally mirror the SDK's raw values (see Condition.swift)
// so admin-authored data can never drift from what the SDK can evaluate.

// --- Shared primitives -------------------------------------------------------

// Matches SDK ConditionType raw values.
export const conditionTypeSchema = z.enum([
	'app_version',
	'os_version',
	'build_number',
	'platform',
	'device_model',
	'region',
	'language',
	'custom_attribute',
]);

// Matches SDK ConditionOperator raw values exactly (note the plural
// `does_not_equals`).
export const conditionOperatorSchema = z.enum([
	'equals',
	'does_not_equals',
	'in',
	'not_in',
	'greater_than',
	'less_than',
	'greater_than_or_equal',
	'less_than_or_equal',
	'between',
	'custom',
]);

export const conditionSchema = z.object({
	type: conditionTypeSchema,
	operator: conditionOperatorSchema,
	values: z.array(z.string()),
});

// A flag value is bool / string / number / JSON object / JSON array.
// Object/array members use z.any() so the inferred type stays assignable to
// Prisma's InputJsonValue (it rejects `unknown` element/value types).
export const flagValueSchema = z.union([
	z.boolean(),
	z.string(),
	z.number(),
	z.record(z.string(), z.any()),
	z.array(z.any()),
]);

// Wire format for flag type is the short form (`bool`/`int`), which the route
// maps to the Prisma enum (BOOL/INT). NOT the SDK output form (boolean/integer).
export const flagTypeSchema = z.enum([
	'bool',
	'string',
	'int',
	'double',
	'date',
	'json',
]);

const envValuesSchema = z.object({
	development: flagValueSchema,
	beta: flagValueSchema,
	production: flagValueSchema,
});

// rolloutValues mirrors envValuesSchema's keys but each env is NULLABLE and holds
// per-flag overrides, not a single flag value. Rollouts are created with all-null
// env slots (see /api/rollouts POST), and config-generator skips null envs — so
// the update path must accept null. Distinct from flag defaultValues, where null
// is not allowed.
const rolloutValuesSchema = z
	.object({
		development: flagValueSchema.nullable(),
		beta: flagValueSchema.nullable(),
		production: flagValueSchema.nullable(),
	})
	.partial();

const id = z.string().min(1);

// --- Create schemas ----------------------------------------------------------

export const createFlagSchema = z.object({
	key: z.string().min(1),
	displayName: z.string().min(1),
	type: flagTypeSchema,
	description: z.string().optional(),
	// Admin-only grouping label (organizational; not published).
	group: z.string().nullable().optional(),
	defaultValues: envValuesSchema,
	appId: id,
});

export const createTestSchema = z.object({
	key: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	group: z.string().nullable().optional(),
	conditions: z.array(conditionSchema),
	variantCount: z.number().int().min(2),
	trafficSplit: z.array(z.number()),
	variantNames: z.array(z.string()),
	appId: id,
});

export const createRolloutSchema = z.object({
	key: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	group: z.string().nullable().optional(),
	conditions: z.array(conditionSchema),
	percentage: z.number().min(0).max(100),
	appId: id,
});

// Unified create used by /api/test-rollouts. type discriminates the payload.
export const createTestRolloutSchema = z
	.object({
		appId: id,
		name: z.string().min(1),
		description: z.string().optional(),
		group: z.string().nullable().optional(),
		type: z.enum(['TEST', 'ROLLOUT']),
		conditions: z.array(conditionSchema).optional(),
		flagIds: z.array(z.string()).optional(),
		variants: z.record(z.string(), z.unknown()).optional(),
		percentage: z.number().min(0).max(100).optional(),
	})
	.refine((d) => d.type !== 'ROLLOUT' || d.percentage !== undefined, {
		message: 'percentage is required for ROLLOUT',
		path: ['percentage'],
	})
	.refine((d) => d.type !== 'TEST' || d.variants !== undefined, {
		message: 'variants is required for TEST',
		path: ['variants'],
	});

// --- Update schemas ----------------------------------------------------------
// Zod strips unknown keys by default, so parsing also drops client-supplied
// id/appId/createdAt/etc. — closing the mass-assignment hole the routes had
// when they spread the raw body into Prisma.

// Flag variants are an env-keyed array blob; validated shallowly to avoid
// over-constraining the conditional-variant internals.
const flagVariantsSchema = z.record(z.string(), z.array(z.unknown()));

export const updateFlagSchema = z.object({
	key: z.string().min(1).optional(),
	displayName: z.string().min(1).optional(),
	type: flagTypeSchema.optional(),
	description: z.string().nullable().optional(),
	group: z.string().nullable().optional(),
	defaultValues: envValuesSchema.optional(),
	variants: flagVariantsSchema.optional(),
	archived: z.boolean().optional(),
});

export const updateTestSchema = z.object({
	key: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	conditions: z.array(conditionSchema).optional(),
	variants: z.record(z.string(), z.unknown()).optional(),
	flagIds: z.array(z.string()).optional(),
	archived: z.boolean().optional(),
});

export const updateRolloutSchema = z.object({
	key: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	conditions: z.array(conditionSchema).optional(),
	percentage: z.number().min(0).max(100).optional(),
	rolloutValues: rolloutValuesSchema.optional(),
	flagIds: z.array(z.string()).optional(),
	archived: z.boolean().optional(),
});

export const updateTestRolloutSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	group: z.string().nullable().optional(),
	conditions: z.array(conditionSchema).optional(),
	flagIds: z.array(z.string()).optional(),
	// Opaque JSON blobs written straight to Prisma; typed loosely so `x || null`
	// stays assignable to the nullable Json column input.
	variants: z.any().optional(),
	rolloutValues: z.any().optional(),
	percentage: z.number().min(0).max(100).optional(),
	archived: z.boolean().optional(),
});

// --- Helper ------------------------------------------------------------------

/**
 * Returns a 400 NextResponse for a Zod validation error, or null if the error
 * is not a Zod error (so the caller can fall through to its 500 handler).
 */
export function zodErrorResponse(error: unknown): NextResponse | null {
	if (error instanceof z.ZodError) {
		return NextResponse.json(
			{ error: 'Invalid request data', details: error.issues },
			{ status: 400 },
		);
	}
	return null;
}
