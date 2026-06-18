// Database entity types (matching Prisma models)

import type {
	Condition,
	ConditionalVariant,
	FetchPolicy,
	FlagType,
	FlagValue,
	PublicKey,
	TestVariant,
} from './core';

export interface AppConfig {
	id: string;
	name: string;
	identifier: string;
	artifact_url: string;
	public_keys: PublicKey[];
	fetch_policy: FetchPolicy;
	created_at: string;
	updated_at: string;
	_count?: {
		flags: number;
		test_rollouts: number;
	};
}

export interface DBFlag {
	id: string;
	key: string;
	displayName: string;
	type: FlagType;
	description?: string;
	/** Admin-only grouping label; not part of the published config. */
	group?: string | null;
	defaultValues: {
		development: FlagValue;
		beta: FlagValue;
		production: FlagValue;
	};
	variants: {
		development: ConditionalVariant[];
		beta: ConditionalVariant[];
		production: ConditionalVariant[];
	};
	archived: boolean;
	archivedAt?: string | null;
	/** Set once the flag first appears in a published artifact; null = never released. */
	firstPublishedAt?: string | null;
	/** Advanced on every publish that includes the flag. */
	lastPublishedAt?: string | null;
	createdAt: string;
	updatedAt: string;
	appId: string;
}

export interface DBTestRollout {
	id: string;
	key: string;
	name: string;
	description?: string;
	type: 'TEST' | 'ROLLOUT';
	salt: string;
	/** Admin-only grouping label; not part of the published config. */
	group?: string | null;
	conditions: Condition[];
	variants?: Record<string, TestVariant>;
	percentage?: number;
	rolloutValues?: {
		development: FlagValue;
		beta: FlagValue;
		production: FlagValue;
	};
	flagIds: string[];
	archived: boolean;
	archivedAt?: string;
	createdAt: string;
	updatedAt: string;
	appId: string;
}

export interface AuditLog {
	id: string;
	app_identifier: string;
	config_version: string;
	published_at: string;
	published_by: string;
	changelog?: string;
	diff: ConfigDiff;
}

export interface ConfigDiff {
	added_flags: string[];
	modified_flags: string[];
	removed_flags: string[];
	added_test_rollouts: string[];
	modified_test_rollouts: string[];
	removed_test_rollouts: string[];
}
