import { expect, test } from '@playwright/test';

const origin = 'http://localhost:4173';

// The compact icon opens the native platform picker; selection is explicit.
const themeSelector = (page: import('@playwright/test').Page) =>
	page.locator('footer .theme-select');

test('defaults to dark and supports native keyboard selection with persistence', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.goto(origin);
	const select = themeSelector(page);
	await expect(select).toHaveAccessibleName('Theme');
	await expect(select).toHaveValue('dark');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(select).toBeEnabled();
	await select.focus();
	await page.keyboard.press('Home');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Escape');
	await expect(select).toHaveValue('light');
	await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
	await expect(page.locator('body')).toHaveCSS(
		'background-color',
		'rgb(248, 250, 252)'
	);
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(
		'light'
	);
	await page.reload();
	await expect(select).toHaveValue('light');
	await page
		.getByRole('link', { name: 'Get Started', exact: true })
		.first()
		.click();
	await expect(page).toHaveURL(/\/app\/settings/);
	await expect(select).toHaveValue('light');
	await select.selectOption('dark');
	await expect(page.locator('body')).toHaveCSS(
		'background-color',
		'rgb(25, 25, 29)'
	);
	await page.reload();
	await expect(select).toHaveValue('dark');
});

for (const preference of ['light', 'dark', 'system'] as const) {
	for (const colorScheme of ['light', 'dark'] as const) {
		test(`restores ${preference} with ${colorScheme} OS before app scripts load`, async ({
			page
		}) => {
			await page.emulateMedia({ colorScheme });
			await page.addInitScript(
				(preference) => localStorage.setItem('theme', preference),
				preference
			);
			await page.route('**/_app/**/*.js', (route) => route.abort());
			await page.goto(origin);
			const resolved = preference === 'system' ? colorScheme : preference;
			await expect(page.locator('html')).toHaveAttribute(
				'data-theme',
				resolved
			);
			await expect(page.locator('html')).toHaveCSS('color-scheme', resolved);
		});
	}
}

test('system follows live device changes and persists across reload and navigation', async ({
	page
}) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.goto(origin);
	const select = themeSelector(page);
	await select.selectOption('system');
	await expect(select).toHaveValue('system');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.emulateMedia({ colorScheme: 'light' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(
		'system'
	);
	await page.reload();
	await expect(select).toHaveValue('system');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await page
		.getByRole('link', { name: 'Get Started', exact: true })
		.first()
		.click();
	await expect(page).toHaveURL(/\/app\/settings/);
	await expect(select).toHaveValue('system');
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await select.selectOption('light');
	await page.emulateMedia({ colorScheme: 'light' });
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect(select).toHaveValue('light');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await select.selectOption('dark');
	await page.emulateMedia({ colorScheme: 'light' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const { language, label, direction, options } of [
	{
		language: 'he',
		label: 'ערכת נושא',
		direction: 'rtl',
		options: ['כהה', 'בהיר', 'מערכת']
	},
	{
		language: 'en',
		label: 'Theme',
		direction: 'ltr',
		options: ['Dark', 'Light', 'System']
	}
]) {
	test(`uses ${language} options and fits the mobile footer`, async ({
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
		const select = footer.getByRole('combobox', { name: label, exact: true });
		await expect(select.locator('option')).toHaveText(options);
		await select.selectOption('light');
		await expect(select).toHaveValue('light');
		await expect(page.locator('main').locator('..')).toHaveAttribute(
			'dir',
			direction
		);
		expect(
			await footer.evaluate(
				(element) => element.scrollWidth <= element.clientWidth
			)
		).toBe(true);
		const box = await select.boundingBox();
		const rem = await page.evaluate(() =>
			Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
		);
		expect(box?.width).toBeGreaterThanOrEqual(2.25 * rem);
		expect(box?.height).toBeGreaterThanOrEqual(2.25 * rem);
		await select.focus();
		await expect(select).toBeFocused();
		await expect(
			page.locator('header').getByRole('combobox', { name: label, exact: true })
		).toHaveCount(0);
	});
}

test('syncs explicit and system preferences changed in another tab', async ({
	page,
	context
}) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.goto(origin);
	const other = await context.newPage();
	await other.goto(origin);
	await themeSelector(other).selectOption('light');
	await expect(themeSelector(page)).toHaveValue('light');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await themeSelector(other).selectOption('system');
	await expect(themeSelector(page)).toHaveValue('system');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.emulateMedia({ colorScheme: 'light' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await other.close();
});

test('can select system and follow OS when saving a preference is blocked', async ({
	page
}) => {
	await page.emulateMedia({ colorScheme: 'dark' });
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
	await themeSelector(page).selectOption('light');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await themeSelector(page).selectOption('system');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.emulateMedia({ colorScheme: 'light' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
