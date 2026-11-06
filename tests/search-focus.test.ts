import { expect, test, type Page } from '@playwright/test';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;

async function measureSearch(page: Page) {
	return page.locator('.header-search input').evaluate((input) => {
		const form = input.closest('form')!;
		const header = input.closest('header')!;
		const box = (element: Element) => {
			const { left, right, top, bottom, height, width } =
				element.getBoundingClientRect();
			return { left, right, top, bottom, height, width };
		};
		return {
			fontSize: parseFloat(getComputedStyle(input).fontSize),
			input: box(input),
			form: box(form),
			header: box(header),
			touch: matchMedia('(any-pointer: coarse)').matches,
			scale: visualViewport?.scale ?? 1,
			viewport: innerWidth,
			scrollWidth: document.documentElement.scrollWidth,
			nav: box(header.querySelector('nav')!),
			viewportMeta: document
				.querySelector('meta[name="viewport"]')
				?.getAttribute('content')
		};
	});
}

function expectTouchGeometry(state: Awaited<ReturnType<typeof measureSearch>>) {
	// Desktop WebKit emulation does not reproduce iOS keyboard auto-zoom.
	// Guard its trigger instead: rendered touch-input text must be at least 16px.
	expect(state.touch).toBe(true);
	expect(state.fontSize).toBeGreaterThanOrEqual(16);
	expect(state.viewportMeta).toBe('width=device-width, initial-scale=1');
	expect(state.scale).toBeCloseTo(1, 2);
	expect(state.header.height, 'retain the compact single-row header').toBe(48);
	expect(state.form.height, 'retain the compact search field').toBe(36);
	expect(state.input.height).toBeLessThanOrEqual(state.form.height - 2);
	expect(state.input.width).toBeGreaterThanOrEqual(80);
	expect(state.input.left).toBeGreaterThanOrEqual(state.form.left);
	expect(state.input.right).toBeLessThanOrEqual(state.form.right);
	expect(state.form.right).toBeLessThanOrEqual(state.nav.left);
	expect(state.nav.right).toBeLessThanOrEqual(state.viewport);
	expect(state.scrollWidth).toBeLessThanOrEqual(state.viewport);
}

for (const width of [320, 390, 844]) {
	for (const language of ['en', 'he']) {
		for (const theme of ['light', 'dark']) {
			test.describe(`touch search ${width}px ${language} ${theme}`, () => {
				test.use({
					viewport: { width, height: width === 844 ? 390 : 844 },
					isMobile: true,
					hasTouch: true
				});
				test('keeps iOS-safe text and compact geometry through focus, clear and search', async ({
					page
				}, info) => {
					await page.addInitScript(
						({ language, theme }) => {
							localStorage.setItem('lang', language);
							localStorage.setItem('theme', theme);
						},
						{ language, theme }
					);
					await page.goto(`${origin}/app/search?q=1040`);
					await expect(page.locator('#console-boot')).toHaveCount(0);
					const input = page.locator('.header-search input');
					await expect(input).toHaveValue('1040');
					await expect(page.locator('.console-shell')).toHaveAttribute(
						'dir',
						language === 'he' ? 'rtl' : 'ltr'
					);
					await expect(page.locator('html')).toHaveAttribute(
						'data-theme',
						theme
					);
					const initial = await measureSearch(page);
					expectTouchGeometry(initial);
					for (const query of ['', '01040184', '']) {
						await input.tap();
						await expect(input).toBeFocused();
						await input.fill(query);
						expectTouchGeometry(await measureSearch(page));
						await page.locator('main h1').tap();
						await expect(input).not.toBeFocused();
						expectTouchGeometry(await measureSearch(page));
					}
					await input.tap();
					await input.fill('01040184');
					await input.press('Enter');
					await expect(page).toHaveURL(`${origin}/app/search?q=01040184`);
					await expect(page.locator('.search-results > li')).toHaveCount(1);
					expectTouchGeometry(await measureSearch(page));
					await page.goBack();
					await expect(input).toHaveValue('1040');
					expectTouchGeometry(await measureSearch(page));
					await page.screenshot({ path: info.outputPath('search-focus.png') });
					// A smaller user root size must not drop touch-input text below iOS's threshold.
					await page.evaluate(
						() => (document.documentElement.style.fontSize = '14px')
					);
					expect((await measureSearch(page)).fontSize).toBeGreaterThanOrEqual(
						16
					);
				});
			});
		}
	}
}

test.describe('desktop search typography', () => {
	test.use({
		viewport: { width: 1180, height: 800 },
		isMobile: false,
		hasTouch: false
	});
	test('preserves compact fine-pointer text', async ({ page }) => {
		await page.goto(`${origin}/app/search?q=1040`);
		await expect(page.locator('#console-boot')).toHaveCount(0);
		const state = await measureSearch(page);
		expect(state.touch).toBe(false);
		expect(state.fontSize).toBe(14);
		expect(state.header.height).toBe(48);
		expect(state.form.height).toBe(36);
	});
});
