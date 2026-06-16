import { expect, test } from '@playwright/test';

test('home loads', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/Bunting Admin/i);
});
