import { expect, type Page } from '@playwright/test';

/** Wait for hydrated search controls and assert that no disclosure hides them. */
export async function expectSearchFiltersVisible(page: Page) {
	const filters = page.locator('fieldset.search-filters');
	await expect(filters).toBeVisible();
	await expect(page.locator('#console-boot')).toHaveCount(0);
	await expect(page.locator('details.search-filters')).toHaveCount(0);
	await expect(filters.locator('legend')).toBeVisible();
	const controls = await filters.locator('input, select, button').all();
	await Promise.all(controls.map((control) => expect(control).toBeVisible()));
	const position = await filters.evaluate((element) => ({
		bottom: element.getBoundingClientRect().bottom,
		headingTop: document.querySelector('main h1')!.getBoundingClientRect().top
	}));
	expect(position.bottom).toBeLessThanOrEqual(position.headingTop);
}
