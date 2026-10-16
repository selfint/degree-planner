import { expect, test, type Page } from '@playwright/test';
const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

async function denyLanguageWrites(
	page: Page,
	language: 'en' | 'he',
	errorName: string
) {
	await page.addInitScript(
		({ language, errorName }) => {
			localStorage.setItem('lang', language);
			const setItem = Storage.prototype.setItem;
			Storage.prototype.setItem = function (key, value) {
				if (key === 'lang')
					throw new DOMException('Preference storage unavailable', errorName);
				setItem.call(this, key, value);
			};
		},
		{ language, errorName }
	);
}

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

for (const errorName of ['SecurityError', 'QuotaExceededError']) {
	test(`legacy /en selects English and opens landing when storage throws ${errorName}`, async ({
		page
	}) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await denyLanguageWrites(page, 'he', errorName);
		await page.goto(`${origin}/en`);
		await expect(page).toHaveURL(`${origin}/`);
		await expect(page.locator('.landing')).toHaveAttribute('dir', 'ltr');
		await expect(
			page
				.locator('main')
				.getByRole('link', { name: 'Get Started', exact: true })
		).toBeVisible();
		expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('he');
		expect(errors).toEqual([]);
	});

	test(`console language changes stay usable when storage throws ${errorName}`, async ({
		page
	}) => {
		const guest = {
			exemptions: [],
			semesters: [[], []],
			currentSemester: 0,
			wishlist: ['02340124']
		};
		await page.addInitScript((guest) => {
			localStorage.setItem('version', '4');
			localStorage.setItem('userData', JSON.stringify(guest));
		}, guest);
		await denyLanguageWrites(page, 'en', errorName);
		await page.goto(`${origin}/app/settings`);
		await expect(page.locator('main')).toBeVisible();
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const language = page.locator('footer select');
		await language.selectOption({ label: 'עב' });
		await expect(page.locator('main').locator('..')).toHaveAttribute(
			'dir',
			'rtl'
		);
		await expect(language.locator('option:checked')).toHaveText('עב');
		await language.selectOption({ label: 'en' });
		await expect(page.locator('main').locator('..')).toHaveAttribute(
			'dir',
			'ltr'
		);
		await expect(language.locator('option:checked')).toHaveText('en');
		expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('en');
		expect(
			await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
		).toEqual(guest);
		expect(errors).toEqual([]);
	});
}
