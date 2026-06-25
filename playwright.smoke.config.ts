import { defineConfig, devices } from '@playwright/test';

/**
 * Config for the full-stack smoke test (`make smoke`).
 *
 * Unlike the default e2e config, this targets only `smoke-key-paths.spec.ts`,
 * which drives the real OIDC/dex login and the create-app → flags → publish
 * flow against the running docker-compose stack. `scripts/smoke.sh` brings that
 * stack up (fresh DB), waits for /api/health, then runs this config.
 */
export default defineConfig({
	testDir: './e2e',
	testMatch: '**/smoke-key-paths.spec.ts',
	// One worker: the spec mutates shared global state (the single fresh DB).
	workers: 1,
	// First-request compilation in `next dev` is slow; be generous.
	timeout: 120_000,
	expect: { timeout: 30_000 },
	reporter: [['list']],
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		viewport: { width: 1280, height: 720 },
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
