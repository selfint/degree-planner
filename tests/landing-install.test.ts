import { expect, test } from '@playwright/test';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

for (const width of [320, 390, 1280]) {
	for (const { language, theme, title, install, offline, storage, open } of [
		{
			language: 'en',
			theme: 'dark',
			title: 'Install PlanIt',
			install: 'Add to Home Screen',
			offline: 'Keep the app open while offline access is being prepared.',
			storage: 'Browser and installed-app storage may be separate',
			open: 'Open PlanIt'
		},
		{
			language: 'he',
			theme: 'light',
			title: 'התקנת PlanIt',
			install: 'הוסף למסך הבית',
			offline: 'השאירו את היישום פתוח בזמן ההכנה לשימוש ללא אינטרנט.',
			storage: 'ייתכן שלדפדפן וליישום המותקן יש אחסון נפרד',
			open: 'פתיחת PlanIt'
		}
	]) {
		test(`installation guidance is inline in ${language} at ${width}`, async ({
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
			const info = page.getByTestId('landing-install-info');
			await expect(info).toHaveAttribute(
				'dir',
				language === 'he' ? 'rtl' : 'ltr'
			);
			await expect(
				info.getByRole('heading', { name: title, exact: true })
			).toBeVisible();
			await expect(info.locator('details, summary')).toHaveCount(0);
			await expect(info.getByRole('heading', { level: 3 })).toHaveCount(3);
			await expect(info.getByText(install, { exact: false })).toBeVisible();
			await expect(info.getByText(offline, { exact: false })).toBeVisible();
			await expect(info.getByText(storage, { exact: false })).toBeVisible();
			const link = info.getByRole('link', { name: open, exact: true });
			await expect(link).toHaveAttribute('href', '/app/');
			await expect(link).toHaveAttribute('data-sveltekit-reload', '');
			const bounds = await link.boundingBox();
			expect(bounds!.height).toBeGreaterThanOrEqual(44);
			await link.focus();
			await expect(link).toBeFocused();
			await expect(link).not.toHaveCSS('outline-style', 'none');
			await expect(page.locator('.landing-gradient')).toHaveCSS(
				'transform',
				'none'
			);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth
				)
			).toBe(true);
			await info.scrollIntoViewIfNeeded();
			await page.screenshot({
				path: testInfo.outputPath('landing-install-inline.png')
			});
			// Include the console's optional-provider delay; guidance must remain static.
			await page.waitForTimeout(1800);
			expect(consoleRequests).toEqual([]);
			await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
		});
	}
}
