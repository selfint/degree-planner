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
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
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
		// Cold unfiltered search renders the complete catalog before the route mounts.
		await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
		await expect(page.locator('#console-boot')).toBeHidden();
		expect(
			await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
		).toEqual(guest);
		expect(errors).toEqual([]);
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

for (const language of ['en', 'he'] as const) {
	test(`${language}: repeated console tabs and history stay in the SPA without the startup overlay`, async ({
		page
	}) => {
		test.setTimeout(60_000);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.addInitScript((language) => {
			localStorage.setItem('lang', language);
			localStorage.setItem('version', '4');
			localStorage.setItem(
				'userData',
				JSON.stringify({
					degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
					path: 'CG00006246',
					exemptions: [],
					semesters: [[], []],
					currentSemester: 0,
					wishlist: ['02340124']
				})
			);
		}, language);
		await page.goto(`${origin}/app/plan`);
		await expect(page.locator('[data-code="02340124"]')).toBeVisible({
			timeout: 20_000
		});
		await expect(page.locator('#console-boot')).toBeHidden();
		const timeOrigin = await page.evaluate(() => performance.timeOrigin);
		await page.evaluate(() => {
			document.documentElement.dataset.consoleEntrySeen = 'false';
			new MutationObserver((records) => {
				for (const record of records)
					for (const node of record.addedNodes) {
						if (
							node instanceof Element &&
							(node.matches('[data-testid="console-entry-loading"]') ||
								node.querySelector('[data-testid="console-entry-loading"]'))
						)
							document.documentElement.dataset.consoleEntrySeen = 'true';
					}
			}).observe(document.body, { childList: true, subtree: true });
		});
		for (const target of ['catalog', 'settings', 'plan', 'catalog', 'plan']) {
			await page.locator(`header a[href="/app/${target}"]`).click();
			await expect(page).toHaveURL(`${origin}/app/${target}`);
			await expect(page.locator('main')).toBeVisible();
			await expect(
				page.locator(`header a[href="/app/${target}"]`)
			).toHaveAttribute('aria-current', 'page');
		}
		await page.goBack();
		await expect(page).toHaveURL(`${origin}/app/catalog`);
		await page.goForward();
		await expect(page).toHaveURL(`${origin}/app/plan`);
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
		await expect(page.locator('html')).toHaveAttribute(
			'data-console-entry-seen',
			'false'
		);
		await expect(page.getByTestId('console-entry-loading')).toHaveCount(0);
	});
}

test.describe('PlanIt brand opens landing separately', () => {
	test.use({ isMobile: true, hasTouch: true });
	for (const width of [320, 390]) {
		for (const language of ['en', 'he'] as const) {
			test(`${width}px ${language}: logo opens a new landing tab and Get Started retains the saved plan`, async ({
				page
			}) => {
				const guest = {
					degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
					exemptions: [],
					semesters: [[], []],
					currentSemester: 0,
					wishlist: ['02340124']
				};
				await page.setViewportSize({ width, height: 664 });
				await page.addInitScript(
					({ guest, language }) => {
						if (localStorage.getItem('userData')) return;
						localStorage.setItem('lang', language);
						localStorage.setItem('version', '4');
						localStorage.setItem('userData', JSON.stringify(guest));
					},
					{ guest, language }
				);
				await page.goto(`${origin}/app/plan`);
				await expect(page.locator('[data-code="02340124"]')).toBeVisible({
					timeout: 30_000
				});
				const brand = page
					.locator('header')
					.getByRole('link', { name: 'PlanIt', exact: true });
				await expect(brand).toHaveAttribute('href', '/');
				await expect(brand).toHaveAttribute('data-sveltekit-reload', '');
				await expect(brand).toHaveAttribute('target', '_blank');
				const consoleOrigin = await page.evaluate(() => performance.timeOrigin);
				const opened = page.waitForEvent('popup');
				await brand.tap();
				const landing = await opened;
				await expect(landing).toHaveURL(`${origin}/`);
				await expect(landing.locator('.landing')).toHaveAttribute(
					'dir',
					language === 'he' ? 'rtl' : 'ltr'
				);
				await expect(landing.locator('.console-shell')).toHaveCount(0);
				expect(await landing.evaluate(() => window.opener)).toBeNull();
				await expect(page).toHaveURL(`${origin}/app/plan`);
				expect(await page.evaluate(() => performance.timeOrigin)).toBe(
					consoleOrigin
				);
				expect(
					await page.evaluate(() =>
						JSON.parse(localStorage.getItem('userData')!)
					)
				).toEqual(guest);
				await landing.locator('header a[href="/app/"]').tap();
				await expect(landing).toHaveURL(`${origin}/app/plan`);
				await expect(landing.locator('[data-code="02340124"]')).toBeVisible({
					timeout: 30_000
				});
				await expect(landing.locator('.console-shell')).toHaveAttribute(
					'dir',
					language === 'he' ? 'rtl' : 'ltr'
				);
				expect(
					await landing.evaluate(() =>
						JSON.parse(localStorage.getItem('userData')!)
					)
				).toEqual(guest);
				await landing.close();
			});
		}
	}
});
