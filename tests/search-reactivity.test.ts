import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
});

test('preserves every filter when slider changes and availability arrive before navigation settles', async ({
	page
}) => {
	await page.goto('/search?q=1040&pointsMin=1&pointsMax=6');
	await expect(page.locator('#search-points-min')).toHaveValue('1');
	// A synchronous burst deliberately exercises the interval that waiting for each URL hides.
	await page.locator('fieldset').evaluate((fieldset) => {
		for (const [id, value] of [
			['search-points-min', '3'],
			['search-points-max', '5']
		]) {
			const input = fieldset.querySelector<HTMLInputElement>(`#${id}`)!;
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}
		fieldset.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
	});
	await expect
		.poll(() => Object.fromEntries(new URL(page.url()).searchParams))
		.toEqual({
			q: '1040',
			available: '',
			pointsMin: '3',
			pointsMax: '5'
		});
	await expect(page.locator('#search-points-min')).toHaveValue('3');
	await expect(page.locator('#search-points-max')).toHaveValue('5');
	await expect(page.getByLabel('Available', { exact: true })).toBeChecked();
});
