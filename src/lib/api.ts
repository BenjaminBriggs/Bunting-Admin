// API utility functions for making requests to our backend

import type {
	ConfigArtifact,
	CreateRolloutRequest,
	CreateTestRequest,
	DBFlag,
	DBTestRollout,
} from '@/types';
import { CreateFlagRequest } from '@/types';

export interface StorageConfig {
	bucket: string;
	region: string;
	endpoint?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
}

export interface App {
	id: string;
	name: string;
	identifier: string;
	artifactUrl: string;
	publicKeys: Array<{ kid: string; pem: string }>;
	fetchPolicy: { min_interval_seconds: number; hard_ttl_days: number };
	storageConfig: StorageConfig;
	createdAt: string;
	updatedAt: string;
	_count?: {
		flags: number;
		test_rollouts: number;
	};
}

// Re-export types for backward compatibility
export type Flag = DBFlag;
export type TestRollout = DBTestRollout;

// Apps API
export async function fetchApps(): Promise<App[]> {
	const response = await fetch('/api/apps');
	if (!response.ok) {
		throw new Error('Failed to fetch apps');
	}
	return response.json();
}

// artifactUrl and storageConfig are server-managed (single global bucket; URL
// derived from CDN_BASE_URL), so they are not part of the create payload.
export type CreateAppInput = Omit<
	App,
	'id' | 'createdAt' | 'updatedAt' | 'artifactUrl' | 'storageConfig' | '_count'
>;

export async function createApp(data: CreateAppInput): Promise<App> {
	const response = await fetch('/api/apps', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to create app');
	}
	return response.json();
}

export async function updateApp(
	id: string,
	data: Partial<Omit<App, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<App> {
	const response = await fetch(`/api/apps/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to update app');
	}
	return response.json();
}

export async function deleteApp(id: string): Promise<void> {
	const response = await fetch(`/api/apps/${id}`, {
		method: 'DELETE',
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to delete app');
	}
}

// Flags API
export async function fetchFlags(appId: string): Promise<Flag[]> {
	const response = await fetch(`/api/flags?appId=${appId}`);
	if (!response.ok) {
		throw new Error('Failed to fetch flags');
	}
	return response.json();
}

export async function fetchFlag(id: string): Promise<Flag> {
	const response = await fetch(`/api/flags/${id}`);
	if (!response.ok) {
		throw new Error('Failed to fetch flag');
	}
	return response.json();
}

export async function createFlag(data: {
	appId: string;
	key: string;
	displayName: string;
	type: string;
	defaultValues: {
		development: any;
		beta: any;
		production: any;
	};
	rules?: any[];
	description?: string;
	group?: string | null;
}): Promise<Flag> {
	const response = await fetch('/api/flags', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to create flag');
	}
	return response.json();
}

export async function updateFlag(
	id: string,
	data: Partial<Flag>,
): Promise<Flag> {
	const response = await fetch(`/api/flags/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to update flag');
	}
	return response.json();
}

export async function archiveFlag(
	id: string,
	archived: boolean,
): Promise<Flag> {
	const response = await fetch(`/api/flags/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ archived }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to archive flag');
	}
	return response.json();
}

export async function deleteFlag(id: string): Promise<void> {
	const response = await fetch(`/api/flags/${id}`, {
		method: 'DELETE',
	});
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.error || 'Failed to delete flag');
	}
}

// Config API

// Thrown when an app-scoped config request 404s — the selected app no longer
// exists (empty DB, recreated DB, or deleted app). Callers treat this as a signal
// to reconcile the app list rather than a hard error to surface.
export class AppNotFoundError extends Error {
	constructor() {
		super('App not found');
		this.name = 'AppNotFoundError';
	}
}

export async function generateCurrentConfig(
	appId: string,
): Promise<ConfigArtifact> {
	const response = await fetch('/api/config/generate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ appId }),
	});
	if (response.status === 404) {
		throw new AppNotFoundError();
	}
	if (!response.ok) {
		const error = await response.json();
		// Surface the server's `details` (the real cause) — not just the generic message.
		const message = error.details
			? `${error.error || 'Failed to generate config'}: ${error.details}`
			: error.error || 'Failed to generate current config';
		throw new Error(message);
	}
	return response.json();
}

export async function getPublishedConfig(
	appIdentifier: string,
): Promise<{ config: any | null; lastModified?: Date; etag?: string }> {
	const response = await fetch('/api/config/published', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ appIdentifier }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to fetch published config');
	}
	return response.json();
}

// Validation API
export interface ValidationResult {
	errors: ValidationError[];
	warnings: ValidationWarning[];
}

export interface ValidationError {
	type: string;
	message: string;
	flagKey?: string;
}

export interface ValidationWarning {
	type: string;
	message: string;
	flagKey?: string;
}

export async function validateConfig(appId: string): Promise<ValidationResult> {
	const response = await fetch('/api/config/validate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ appId }),
	});
	if (response.status === 404) {
		throw new AppNotFoundError();
	}
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to validate configuration');
	}
	return response.json();
}

// Publish API
export async function publishConfig(
	appId: string,
	changelog: string,
): Promise<{ version: string; publishedAt: string; message: string }> {
	const response = await fetch('/api/config/publish', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ appId, changelog }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to publish configuration');
	}
	return response.json();
}

// Publish History API
export interface PublishHistoryItem {
	id: string;
	version: string;
	publishedAt: string;
	publishedBy: string;
	changelog: string;
	flagCount: number;
	changes?: Array<{
		type: 'flag';
		action: 'added' | 'modified' | 'removed';
		key: string;
		name: string;
	}>;
}

export async function getPublishHistory(
	appId: string,
	limit: number = 10,
): Promise<PublishHistoryItem[]> {
	const response = await fetch('/api/config/history', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ appId, limit }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to fetch publish history');
	}
	return response.json();
}

export interface DecodedFingerprintResponse {
	version: string;
	env: 'development' | 'beta' | 'production';
	publishedAt: string;
	appIdentifier: string;
	flags: Record<
		string,
		{ type: string; value: unknown; reason: string }
	>;
}

export async function decodeFingerprint(
	appId: string,
	code: string,
): Promise<DecodedFingerprintResponse> {
	const response = await fetch('/api/config/decode', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ appId, code }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to decode fingerprint');
	}
	return response.json();
}

export async function downloadConfig(appIdentifier: string): Promise<void> {
	const response = await fetch('/api/config/download', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ appIdentifier }),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to download configuration');
	}

	// Get the filename from the response headers
	const contentDisposition = response.headers.get('Content-Disposition');
	const filename = contentDisposition
		? contentDisposition.split('filename="')[1]?.replace('"', '') ||
			'config.json'
		: 'config.json';

	// Create blob and download
	const blob = await response.blob();
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);
}

// Tests API
export async function fetchTests(appId: string): Promise<TestRollout[]> {
	const response = await fetch(`/api/tests?appId=${appId}`);
	if (!response.ok) {
		throw new Error('Failed to fetch tests');
	}
	return response.json();
}

export async function fetchTest(id: string): Promise<TestRollout> {
	const response = await fetch(`/api/tests/${id}`);
	if (!response.ok) {
		throw new Error('Failed to fetch test');
	}
	return response.json();
}

export async function createTest(
	data: CreateTestRequest,
): Promise<TestRollout> {
	const response = await fetch('/api/tests', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to create test');
	}
	return response.json();
}

export async function updateTest(
	id: string,
	data: Partial<TestRollout>,
): Promise<TestRollout> {
	const response = await fetch(`/api/tests/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to update test');
	}
	return response.json();
}

export async function deleteTest(id: string): Promise<void> {
	const response = await fetch(`/api/tests/${id}`, {
		method: 'DELETE',
	});
	if (!response.ok) {
		throw new Error('Failed to delete test');
	}
}

// Rollouts API
export async function fetchRollouts(appId: string): Promise<TestRollout[]> {
	const response = await fetch(`/api/rollouts?appId=${appId}`);
	if (!response.ok) {
		throw new Error('Failed to fetch rollouts');
	}
	return response.json();
}

export async function fetchRollout(id: string): Promise<TestRollout> {
	const response = await fetch(`/api/rollouts/${id}`);
	if (!response.ok) {
		throw new Error('Failed to fetch rollout');
	}
	return response.json();
}

export async function createRollout(
	data: CreateRolloutRequest,
): Promise<TestRollout> {
	const response = await fetch('/api/rollouts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to create rollout');
	}
	return response.json();
}

export async function updateRollout(
	id: string,
	data: Partial<TestRollout>,
): Promise<TestRollout> {
	const response = await fetch(`/api/rollouts/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to update rollout');
	}
	return response.json();
}

export async function deleteRollout(id: string): Promise<void> {
	const response = await fetch(`/api/rollouts/${id}`, {
		method: 'DELETE',
	});
	if (!response.ok) {
		throw new Error('Failed to delete rollout');
	}
}

export async function fetchTestsAndRolloutsForFlag(
	appId: string,
	flagId: string,
): Promise<{ tests: TestRollout[]; rollouts: TestRollout[] }> {
	const response = await fetch(
		`/api/test-rollouts?appId=${appId}&flagId=${flagId}`,
	);
	if (!response.ok) {
		throw new Error('Failed to fetch tests and rollouts for flag');
	}
	const data = await response.json();
	return {
		tests: data.filter((item: TestRollout) => item.type === 'TEST'),
		rollouts: data.filter((item: TestRollout) => item.type === 'ROLLOUT'),
	};
}

export async function updateRolloutPercentage(
	id: string,
	percentage: number,
): Promise<TestRollout> {
	const response = await fetch(`/api/rollouts/${id}/percentage`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ percentage }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to update rollout percentage');
	}
	return response.json();
}

export async function archiveTestRollout(
	id: string,
	type: 'cancel' | 'complete',
): Promise<TestRollout> {
	const response = await fetch(`/api/test-rollouts/${id}/archive`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ type }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to archive test/rollout');
	}
	return response.json();
}

// Unified test/rollout creation function
export async function createTestRollout(data: {
	appId: string;
	name: string;
	description?: string;
	group?: string | null;
	type: 'TEST' | 'ROLLOUT';
	variants?: Record<string, { percentage: number; value: any }>;
	percentage?: number;
	conditions?: any[];
	flagIds?: string[];
}): Promise<TestRollout> {
	const response = await fetch('/api/test-rollouts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to create test/rollout');
	}
	return response.json();
}

export async function fetchTestRollout(id: string): Promise<TestRollout> {
	const response = await fetch(`/api/test-rollouts/${id}`);
	if (!response.ok) {
		throw new Error('Failed to fetch test/rollout');
	}
	return response.json();
}

export async function updateTestRollout(
	id: string,
	data: Partial<TestRollout>,
): Promise<TestRollout> {
	const response = await fetch(`/api/test-rollouts/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to update test/rollout');
	}
	return response.json();
}
