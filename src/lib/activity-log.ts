/**
 * Change trail for entity mutations (flags, tests, rollouts, apps, signing keys,
 * users, access list).
 *
 * This is distinct from the publish ledger (`AuditLog`): that table records
 * signed-config publishes and is load-bearing for version allocation. The
 * ActivityLog answers "who changed what, when" for the authoring entities.
 *
 * Writes are best-effort: a failure to record the trail must never fail the
 * underlying mutation. Failures are logged, not thrown.
 */
import type { Prisma } from '@/generated/prisma/client';
import { getRequestRole } from './authz';
import { prisma } from './db';
import { logger } from './logger';

export type ActivityAction =
	| 'create'
	| 'update'
	| 'delete'
	| 'archive'
	| 'unarchive'
	| 'rotate';

export type EntityType =
	| 'flag'
	| 'test'
	| 'rollout'
	| 'app'
	| 'signing_key'
	| 'user'
	| 'access_list';

export interface ActivityInput {
	actor: string;
	action: ActivityAction;
	entityType: EntityType;
	entityId: string;
	appId?: string | null;
	summary?: string;
	/** Optional before/after snapshot; keep small and free of secrets. */
	changes?: Record<string, unknown> | null;
}

/**
 * Record an entity mutation. Best-effort — never throws into the request path.
 */
export async function logActivity(input: ActivityInput): Promise<void> {
	try {
		await prisma.activityLog.create({
			data: {
				actor: input.actor,
				action: input.action,
				entityType: input.entityType,
				entityId: input.entityId,
				appId: input.appId ?? null,
				summary: input.summary ?? null,
				changes:
					input.changes == null
						? undefined
						: (input.changes as Prisma.InputJsonValue),
			},
		});
	} catch (err) {
		logger.error(
			{
				err,
				action: input.action,
				entityType: input.entityType,
				entityId: input.entityId,
			},
			'failed to write activity log',
		);
	}
}

/**
 * Resolve the acting user's email for an activity record. Returns 'unknown' if
 * the identity cannot be resolved (the mutation itself already passed the auth
 * middleware, so this is only a best-effort label).
 */
export async function actorFromHeaders(headers: Headers): Promise<string> {
	try {
		const ctx = await getRequestRole(headers);
		return ctx?.email ?? 'unknown';
	} catch {
		return 'unknown';
	}
}
