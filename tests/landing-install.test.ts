import { expect, test } from '@playwright/test';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

for (const width of [320, 390, 1280]) {
	for (const { language, theme } of [
		{ language: 'en', theme: 'dark' },
		{ language: 'he', theme: 'light' }
	]) {
		test(`original landing layout is preserved in ${language} at ${width}`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize({ width, height: 844 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript(
				({ language, theme }) => {
					localStorage.setItem('lang', language);
					localStorage.setItem('theme', theme);
				},
				{ language, theme }
			);
			const consoleRequests: string[] = [];
			page.on('request', (request) => {
				const url = new URL(request.url());
				if (
					/\/app(?:\/|$)|\/(?:catalogs|courseData(?:Stripped)?)\.json$|\/_courses\/|\/_catalogs\/|\/service-worker\.js$|\/manifest\.webmanifest$/.test(
						url.pathname
					) ||
					/firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|firebaseinstallations\.googleapis\.com/.test(
						url.hostname
					)
				) {
					consoleRequests.push(url.pathname);
				}
			});
			await page.goto(origin);

			const landing = page.locator('.landing');
			await expect(landing).toHaveAttribute(
				'dir',
				language === 'he' ? 'rtl' : 'ltr'
			);
			await expect(page.getByTestId('landing-install-info')).toHaveCount(0);
			await expect(page.getByTestId('landing-tutorials')).toHaveCount(0);
			await expect(landing.locator('video')).toHaveCount(7);
			await expect(landing.locator('svg[viewBox="0 0 265 141"]')).toBeVisible();
			await expect(landing.locator('h1')).toHaveClass(/text-5xl/);
			const feature = page
				.getByTestId('feature-plan')
				.locator('xpath=ancestor::section');
			const media = await feature.locator('video').boundingBox();
			const heading = await feature.locator('h2').boundingBox();
			if (width < 640) {
				expect(media!.y).toBeLessThan(heading!.y);
			} else {
				expect(Math.abs(media!.y - heading!.y)).toBeLessThan(20);
				expect(media!.width).toBeGreaterThan(heading!.width);
				if (language === 'he') expect(media!.x).toBeGreaterThan(heading!.x);
				else expect(media!.x).toBeLessThan(heading!.x);
			}
			const link = landing.locator('a[href="/app/"]');
			await expect(link).toHaveAttribute('data-sveltekit-reload', '');
			await link.focus();
			await expect(link).toBeFocused();
			await expect(page.locator('.landing-gradient')).toHaveCSS(
				'transform',
				'none'
			);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth
				)
			).toBe(true);

			await page.screenshot({
				path: testInfo.outputPath('landing-original-layout.png')
			});
			// The original public landing must remain independent of console startup.
			await page.waitForTimeout(1800);
			expect(consoleRequests).toEqual([]);
			await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
		});
	}
}
