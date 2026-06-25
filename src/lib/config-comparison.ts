// Utility functions for comparing configurations

// A config item (flag/test/rollout) as it appears in a published artifact. The
// shape is only loosely known here (it comes from S3 JSON), so values are
// `unknown`; we only ever read an optional `name`.
// A config section (flags/tests/rollouts) as it appears in a published
// artifact. Values are only loosely known here (they come from S3 JSON), so
// they are `unknown` and narrowed when a specific field is read. Using
// `Record<string, unknown>` keeps the real `ConfigArtifact` (from types/core)
// assignable to these parameters.
type ConfigItemMap = Record<string, unknown>;

export interface ConfigArtifact {
	schema_version: number;
	config_version: string | null;
	published_at: string | null;
	app_identifier: string;
	// Schema v1 keeps flags at the top level.
	flags?: ConfigItemMap;
	development?: {
		flags: ConfigItemMap;
		test_rollouts?: ConfigItemMap;
	};
	beta?: {
		flags: ConfigItemMap;
		test_rollouts?: ConfigItemMap;
	};
	production?: {
		flags: ConfigItemMap;
		test_rollouts?: ConfigItemMap;
	};
	tests?: ConfigItemMap;
	rollouts?: ConfigItemMap;
}

// Helper functions to extract data from both schema versions
function extractFlags(config: ConfigArtifact): ConfigItemMap {
	// Schema v1 has flags at the top level
	return config.flags ?? {};
}

function extractTests(config: ConfigArtifact): ConfigItemMap {
	return config.tests ?? {};
}

function extractRollouts(config: ConfigArtifact): ConfigItemMap {
	return config.rollouts ?? {};
}

// Compare two configs and return whether they are different
export function hasConfigChanges(
	currentConfig: ConfigArtifact,
	publishedConfig: ConfigArtifact | null,
): boolean {
	// If there's no published config, we definitely have changes
	if (!publishedConfig) {
		return true;
	}

	// Compare flags (environment-aware)
	const currentFlags = extractFlags(currentConfig);
	const publishedFlags = extractFlags(publishedConfig);

	if (
		JSON.stringify(sortObject(currentFlags)) !==
		JSON.stringify(sortObject(publishedFlags))
	) {
		return true;
	}

	// Compare tests
	const currentTests = extractTests(currentConfig);
	const publishedTests = extractTests(publishedConfig);

	if (
		JSON.stringify(sortObject(currentTests)) !==
		JSON.stringify(sortObject(publishedTests))
	) {
		return true;
	}

	// Compare rollouts
	const currentRollouts = extractRollouts(currentConfig);
	const publishedRollouts = extractRollouts(publishedConfig);

	if (
		JSON.stringify(sortObject(currentRollouts)) !==
		JSON.stringify(sortObject(publishedRollouts))
	) {
		return true;
	}

	// App identifier should match
	if (currentConfig.app_identifier !== publishedConfig.app_identifier) {
		return true;
	}

	return false;
}

// Get detailed changes between configs
export interface ConfigChange {
	type: 'flag' | 'test' | 'rollout';
	action: 'added' | 'modified' | 'removed';
	key: string;
	name: string;
	details?: string[];
}

export function getConfigChanges(
	currentConfig: ConfigArtifact,
	publishedConfig: ConfigArtifact | null,
): ConfigChange[] {
	const changes: ConfigChange[] = [];

	if (!publishedConfig) {
		// All current items are "added"
		Object.keys(extractFlags(currentConfig)).forEach((key) => {
			changes.push({
				type: 'flag',
				action: 'added',
				key,
				name: `Flag: ${key}`,
			});
		});

		return changes;
	}

	diffSection(
		'flag',
		'Flag',
		extractFlags(currentConfig),
		extractFlags(publishedConfig),
		changes,
	);
	diffSection(
		'test',
		'Test',
		extractTests(currentConfig),
		extractTests(publishedConfig),
		changes,
	);
	diffSection(
		'rollout',
		'Rollout',
		extractRollouts(currentConfig),
		extractRollouts(publishedConfig),
		changes,
	);

	return changes;
}

// Diff one section (flags/tests/rollouts) of the config and append the changes.
// Flags are labelled by key; tests/rollouts prefer the item's `name`.
function diffSection(
	kind: ConfigChange['type'],
	label: string,
	current: ConfigItemMap,
	published: ConfigItemMap,
	changes: ConfigChange[],
): void {
	const nameFor = (key: string, item: unknown): string => {
		if (kind === 'flag') {
			return `${label}: ${key}`;
		}
		const name = (item as { name?: string } | undefined)?.name;
		return `${label}: ${name ?? key}`;
	};

	for (const key of Object.keys(current)) {
		const cur = current[key];
		const pub = published[key];
		if (!pub) {
			changes.push({
				type: kind,
				action: 'added',
				key,
				name: nameFor(key, cur),
			});
		} else if (JSON.stringify(cur) !== JSON.stringify(pub)) {
			changes.push({
				type: kind,
				action: 'modified',
				key,
				name: nameFor(key, cur),
				details: getObjectDifferences(
					(cur ?? {}) as Record<string, unknown>,
					pub as Record<string, unknown>,
				),
			});
		}
	}

	for (const key of Object.keys(published)) {
		if (!current[key]) {
			changes.push({
				type: kind,
				action: 'removed',
				key,
				name: nameFor(key, published[key]),
			});
		}
	}
}

// Helper function to sort object keys for consistent comparison
function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
	return Object.keys(obj)
		.sort()
		.reduce<Record<string, unknown>>((result, key) => {
			result[key] = obj[key];
			return result;
		}, {});
}

// Helper function to get differences between two objects
function getObjectDifferences(
	current: Record<string, unknown>,
	published: Record<string, unknown>,
): string[] {
	const differences: string[] = [];

	// Simple implementation - just check top-level properties
	const allKeys = new Set([...Object.keys(current), ...Object.keys(published)]);

	allKeys.forEach((key) => {
		if (current[key] !== published[key]) {
			if (current[key] === undefined) {
				differences.push(`Removed: ${key}`);
			} else if (published[key] === undefined) {
				differences.push(`Added: ${key}`);
			} else {
				differences.push(
					`Changed: ${key} (${JSON.stringify(published[key])} → ${JSON.stringify(current[key])})`,
				);
			}
		}
	});

	return differences;
}
