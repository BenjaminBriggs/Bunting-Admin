import { buildBootstrapDocument } from '@/lib/bootstrap';

describe('buildBootstrapDocument', () => {
	it('includes app_identifier and all bootstrap fields', () => {
		const doc = buildBootstrapDocument({
			appIdentifier: 'feast-ios',
			endpointUrl: 'https://cdn.example.com/feast/config.json',
			publicKeys: [{ kid: 'k1', pem: 'PEM' }],
			fetchPolicy: { min_interval_seconds: 3600, hard_ttl_days: 3 },
		});
		expect(doc).toEqual({
			app_identifier: 'feast-ios',
			endpoint_url: 'https://cdn.example.com/feast/config.json',
			public_keys: [{ kid: 'k1', pem: 'PEM' }],
			fetch_policy: { min_interval_seconds: 3600, hard_ttl_days: 3 },
		});
	});

	it('applies the 21600 / 7 fetch defaults when policy is null or partial', () => {
		const doc = buildBootstrapDocument({
			appIdentifier: 'a',
			endpointUrl: 'https://x/config.json',
			publicKeys: [],
			fetchPolicy: null,
		});
		expect(doc.fetch_policy).toEqual({
			min_interval_seconds: 21600,
			hard_ttl_days: 7,
		});
	});
});
