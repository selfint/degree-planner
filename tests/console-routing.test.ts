import { expect, test } from '@playwright/test';
const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
for (const path of ['/settings', '/search', '/course/02340124']) {
	test(`legacy ${path} keeps its query, fragment and same-origin plan`, async ({
		page
	}) => {
		const guest = {
			exemptions: [],
			semesters: [[], []],
			currentSemester: 0,
			wishlist: ['02340124']
		};
		await page.addInitScript((guest) => {
			localStorage.setItem('lang', 'en');
			localStorage.setItem('version', '4');
			localStorage.setItem('userData', JSON.stringify(guest));
		}, guest);
		await page.goto(`${origin}${path}?source=old-link#details`);
		await expect(page).toHaveURL(
			`${origin}/app${path}?source=old-link#details`
		);
		await expect(page.locator('main')).toBeVisible();
		await expect(page.locator('#console-boot')).toBeHidden();
		expect(
			await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
		).toEqual(guest);
	});
}
