import { expect, test } from '@playwright/test';

test('index page has website title', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Technion Course Plot' })).toBeVisible();
});
