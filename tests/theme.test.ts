import { expect, test } from '@playwright/test';

const origin = 'http://localhost:4173';

test('defaults to dark and supports keyboard switching with persistence', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.goto(origin);
	const toggle = page.getByRole('button', { name: 'Light mode', exact: true });
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(toggle).toBeEnabled();
	await toggle.focus();
	await page.keyboard.press('Space');
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
	await expect(page.locator('body')).toHaveCSS(
		'background-color',
		'rgb(248, 250, 252)'
	);
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(
		'light'
	);

	await page.reload();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await page
		.getByRole('link', { name: 'Get Started', exact: true })
		.first()
		.click();
	await expect(page).toHaveURL(/\/app\/settings/);
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await toggle.click();
	await expect(page.locator('body')).toHaveCSS(
		'background-color',
		'rgb(25, 25, 29)'
	);
	await page.reload();
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('restores light mode even before the app scripts load', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('theme', 'light'));
	await page.route('**/_app/**/*.js', (route) => route.abort());
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.goto(origin);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await expect(page.locator('body')).toHaveCSS(
		'background-color',
		'rgb(248, 250, 252)'
	);
});

for (const { language, label, direction } of [
	{ language: 'he', label: 'מצב בהיר', direction: 'rtl' },
	{ language: 'en', label: 'Light mode', direction: 'ltr' }
]) {
	test(`uses the ${language} label and fits the mobile footer`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 740 });
		await page.addInitScript((language) => {
			localStorage.setItem('lang', language);
			localStorage.setItem('version', '4');
			localStorage.setItem(
				'userData',
				JSON.stringify({
					degree: ['2026_200', '00002330', 'SC00001356_CG00011002'],
					exemptions: [],
					semesters: [[], []],
					currentSemester: 0,
					wishlist: []
				})
			);
		}, language);
		await page.goto(origin + '/app/plan');
		const footer = page.locator('footer');
		const toggle = footer.getByRole('button', { name: label, exact: true });
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('main').locator('..')).toHaveAttribute(
			'dir',
			direction
		);
		expect(
			await footer.evaluate(
				(element) => element.scrollWidth <= element.clientWidth
			)
		).toBe(true);
		const box = await toggle.boundingBox();
		// The console footer uses the compact 2.25rem control; the landing keeps 2.75rem.
		const rem = await page.evaluate(() =>
			Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
		);
		expect(box?.width).toBeGreaterThanOrEqual(2.25 * rem);
		expect(box?.height).toBeGreaterThanOrEqual(2.25 * rem);
		await toggle.focus();
		await expect(toggle).toBeFocused();
		await expect(
			page.locator('header').getByRole('button', { name: label, exact: true })
		).toHaveCount(0);
	});
}

test('syncs a preference changed in another tab', async ({ page, context }) => {
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.goto(origin);
	const other = await context.newPage();
	await other.goto(origin);
	await other.getByRole('button', { name: 'Light mode', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Light mode', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await other.close();
});

test('can switch when saving a preference is blocked', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.goto(origin);
	await page.evaluate(() => {
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key, value) {
			if (key === 'theme')
				throw new DOMException('Storage is full', 'QuotaExceededError');
			setItem.call(this, key, value);
		};
	});
	await page.getByRole('button', { name: 'Light mode', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
