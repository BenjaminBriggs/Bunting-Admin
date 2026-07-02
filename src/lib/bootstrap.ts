export interface BootstrapInput {
	appIdentifier: string;
	endpointUrl: string;
	publicKeys: Array<{ kid: string; pem: string }>;
	fetchPolicy: { min_interval_seconds?: number; hard_ttl_days?: number } | null;
}

export interface BootstrapDocument {
	app_identifier: string;
	endpoint_url: string;
	public_keys: Array<{ kid: string; pem: string }>;
	fetch_policy: { min_interval_seconds: number; hard_ttl_days: number };
}

/**
 * Build the platform-neutral bootstrap document. Apple renders this as
 * BuntingConfig.plist; Android consumes it as bunting_config.json; web
 * implementers use it directly. Applies the standard fetch-policy defaults.
 */
export function buildBootstrapDocument(
	input: BootstrapInput,
): BootstrapDocument {
	return {
		app_identifier: input.appIdentifier,
		endpoint_url: input.endpointUrl,
		public_keys: input.publicKeys,
		fetch_policy: {
			min_interval_seconds: input.fetchPolicy?.min_interval_seconds ?? 21600,
			hard_ttl_days: input.fetchPolicy?.hard_ttl_days ?? 7,
		},
	};
}
