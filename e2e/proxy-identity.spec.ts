import { expect, test } from '@playwright/test';

// The CI e2e job runs the production build in proxy auth mode (see
// .github/workflows/admin-tests.yml). Identity comes from a reverse-proxy
// header and there is no NextAuth client session, so client-side routing must
// use GET /api/me: a proxied user lands in the app, not on the sign-in page.
const proxyMode = process.env.AUTH_MODE === 'proxy';
const emailHeader = (
	process.env.AUTH_PROXY_EMAIL_HEADER ?? 'x-forwarded-email'
).toLowerCase();

test.describe('proxy auth mode', () => {
	test.skip(!proxyMode, 'needs the app running with AUTH_MODE=proxy');

	test('without a proxy identity, / goes to sign-in', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/auth\/signin/);
	});

	test('with a proxy identity, / lands in the app instead of sign-in', async ({
		browser,
	}) => {
		// extraHTTPHeaders apply to the page and to its fetches (/api/me, /api/apps).
		const context = await browser.newContext({
			extraHTTPHeaders: { [emailHeader]: 'e2e-admin@example.com' },
		});
		const page = await context.newPage();
		await page.goto('/');

		// A fresh database has no apps, so the dashboard funnels to setup; with
		// apps it stays on the dashboard. Either way, never the sign-in page.
		await expect(page).toHaveURL(/\/(dashboard|setup\/app)/);
		await expect(page).not.toHaveURL(/\/auth\/signin/);
		if (page.url().includes('/setup/app')) {
			await expect(
				page.getByText('Create your first application'),
			).toBeVisible();
		}
		await context.close();
	});
});
