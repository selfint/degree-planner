import { expect, test } from '@playwright/test';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

for (const width of [390, 1280]) {
	for (const language of ['he', 'en']) {
		for (const theme of ['light', 'dark']) {
			test(`${width}px ${language} ${theme}: Get Started stays white in every interaction state`, async ({
				page
			}) => {
				await page.setViewportSize({ width, height: 844 });
				await page.addInitScript(
					({ language, theme }) => {
						localStorage.setItem('lang', language);
						localStorage.setItem('theme', theme);
					},
					{ language, theme }
				);
				await page.goto(origin);
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
				for (const region of ['header', 'main']) {
					const start = page.locator(region).getByRole('link', {
						name: language === 'he' ? 'התחל' : 'Get Started',
						exact: true
					});
					await expect(start).toBeVisible();
					await expect(start).toHaveCSS('color', 'rgb(255, 255, 255)');
					await start.hover();
					await expect(start).toHaveCSS('color', 'rgb(255, 255, 255)');
					await start.focus();
					await expect(start).toBeFocused();
					await expect(start).toHaveCSS('color', 'rgb(255, 255, 255)');
					await page.mouse.down();
					try {
						expect(
							await start.evaluate((link) => link.matches(':active'))
						).toBe(true);
						await expect(start).toHaveCSS('color', 'rgb(255, 255, 255)');
					} finally {
						// Release away from the link so checking :active does not navigate.
						await page.mouse.move(0, 0);
						await page.mouse.up();
					}
				}
			});
		}
	}
}
