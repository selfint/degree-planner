import { expect, type Page } from '@playwright/test';

/** Search opens with results first; interaction tests explicitly reveal its filters. */
export async function openSearchFilters(page: Page) {
	const panel = page.locator('details.search-filters');
	await expect(panel).toBeVisible();
	if ((await panel.getAttribute('open')) === null)
		await panel.locator('summary').click();
	await expect(panel).toHaveAttribute('open', '');
}
