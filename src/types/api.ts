// API request and response types

import type {
	Condition,
	ConfigArtifact,
	FlagType,
	FlagValue,
	TestRollout,
} from './core';
import type { DBFlag } from './database';

// UI-specific types for flag management
export interface FlagListItem extends DBFlag {
	testRollouts?: {
		development: TestRollout[];
		beta: TestRollout[];
		production: TestRollout[];
	};
}

// Form types for creating/editing
export interface CreateFlagRequest {
	key: string;
	displayName: string;
	type: FlagType;
	description?: string;
	defaultValues: {
		development: FlagValue;
		beta: FlagValue;
		production: FlagValue;
	};
	appId: string;
}

export interface CreateTestRequest {
	key: string;
	name: string;
	description?: string;
	group?: string | null;
	conditions: Condition[];
	variantCount: number; // 2 for A/B, 3 for A/B/C, etc.
	trafficSplit: number[]; // [50, 50] or [33, 33, 34]
	variantNames: string[]; // ["Control", "New Design", "Alternative"]
	appId: string;
}

export interface CreateRolloutRequest {
	key: string;
	name: string;
	description?: string;
	group?: string | null;
	conditions: Condition[];
	percentage: number;
	appId: string;
}

export interface PublishRequest {
	config: ConfigArtifact;
	changelog?: string;
}
