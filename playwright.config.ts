import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	// The full-stack smoke (login → app → flags → publish) needs the OIDC/dex
	// stack and is driven by `make smoke` via playwright.smoke.config.ts. Keep it
	// out of the default CI e2e run, which builds a prod app in proxy mode.
	testIgnore: '**/smoke-key-paths.spec.ts',
	reporter: process.env.CI
		? [['github'], ['list']]
		: [['html', { open: 'never' }], ['list']],
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
		trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
		viewport: { width: 1280, height: 720 },
	},
	workers: process.env.CI ? 1 : undefined,
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
