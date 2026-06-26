import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Full-stack smoke: drives the real key paths against the docker-compose stack
 * (OIDC/dex auth, Postgres, MinIO). Run via `make smoke` (which brings up a
 * fresh stack first). NOT part of the default CI e2e run — see playwright.config.ts.
 *
 * Path: dex login → create app → create a flag of each of the 6 types → publish.
 */

const DEX_EMAIL = 'admin@bunting.dev';
const DEX_PASSWORD = 'password';

const APP_NAME = 'Smoke App';

type FlagSpec = {
	type: 'bool' | 'string' | 'int' | 'double' | 'date' | 'json';
	name: string;
	setValue: (page: Page, value: Locator) => Promise<void>;
};

const FLAGS: FlagSpec[] = [
	{
		type: 'bool',
		name: 'Smoke Bool Flag',
		setValue: async (_page, value) => {
			await value.getByText('true', { exact: true }).click();
		},
	},
	{
		type: 'string',
		name: 'Smoke String Flag',
		setValue: async (_page, value) => {
			await value.locator('input').fill('hello_smoke');
		},
	},
	{
		type: 'int',
		name: 'Smoke Int Flag',
		setValue: async (_page, value) => {
			await value.locator('input').fill('42');
		},
	},
	{
		type: 'double',
		name: 'Smoke Double Flag',
		setValue: async (_page, value) => {
			await value.locator('input').fill('3.14');
		},
	},
	{
		type: 'date',
		name: 'Smoke Date Flag',
		setValue: async (_page, value) => {
			await value.locator('input[type="date"]').fill('2026-06-25');
		},
	},
	{
		type: 'json',
		name: 'Smoke Json Flag',
		setValue: async (page, value) => {
			// The default-value control for json is a `{}` chip that opens an
			// "Edit JSON" dialog with a textarea + Save button.
			await value.getByText('{}', { exact: true }).click();
			const dialog = page.getByRole('dialog');
			await dialog.getByRole('textbox').first().fill('{"smoke": true}');
			await dialog.getByRole('button', { name: 'Save' }).click();
		},
	},
];

async function loginViaDex(page: Page) {
	await page.goto('/auth/signin');
	await page.getByTestId('sso-signin').click();
	// Redirected to dex (auth.localhost:5556). The password connector form has
	// login + password fields and a submit button.
	await page.locator('input[name="login"]').fill(DEX_EMAIL);
	await page.locator('input[name="password"]').fill(DEX_PASSWORD);
	await page.locator('button[type="submit"]').click();
	// skipApprovalScreen → callback → app. A fresh DB has no apps, so the app
	// funnels a logged-in user to /setup/app.
	await page.waitForURL(/\/setup\/app|\/dashboard/, { timeout: 60_000 });
}

test('key paths: login → app → flag of each type → publish', async ({
	page,
}) => {
	await test.step('sign in via dex OIDC', async () => {
		await loginViaDex(page);
	});

	await test.step('create the first app', async () => {
		await page.goto('/setup/app');
		await page.getByTestId('app-name').fill(APP_NAME);
		await page.getByTestId('setup-next').click();
		await page.getByTestId('create-app').click();
		await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
	});

	for (const flag of FLAGS) {
		await test.step(`create ${flag.type} flag`, async () => {
			// Navigate via the sidebar (client-side) so `selectedApp` stays in
			// context — a full page-load of /dashboard/flags/new redirects to
			// /dashboard before the app context hydrates.
			await page.getByRole('button', { name: 'New Flags' }).click();
			await expect(page.getByTestId('flag-name')).toBeVisible();
			await page.getByTestId('flag-name').fill(flag.name);
			// Select the type first — it resets the per-env default values.
			await page.getByTestId(`flag-type-${flag.type}`).click();
			await flag.setValue(page, page.getByTestId('flag-default-value'));

			const save = page.getByTestId('flag-save');
			await expect(save).toBeEnabled();
			await save.click();

			await page.waitForURL('**/dashboard/flags', { timeout: 60_000 });
			await expect(page.getByText(flag.name, { exact: false })).toBeVisible();
		});
	}

	await test.step('publish the config', async () => {
		await page.goto('/dashboard/publish');
		await page
			.getByPlaceholder(/Describe what's going live/i)
			.fill('Smoke test release');

		const publish = page.getByTestId('publish-button');
		await expect(publish).toBeEnabled();
		await publish.click();

		const success = page.getByTestId('publish-success');
		await expect(success).toBeVisible({ timeout: 60_000 });
		await expect(success).toContainText(/published successfully/i);
	});
});
