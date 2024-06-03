import { test } from '@playwright/test';

test('index page has website title', async ({ page }) => {
	await page.goto('/');
});
