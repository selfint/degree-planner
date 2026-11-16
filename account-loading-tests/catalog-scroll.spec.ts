import { expect, test } from '@playwright/test';

test.use({ isMobile: true, hasTouch: true });
for (const width of [320, 390]) {
	for (const language of ['en', 'he']) {
		test(`${width}px ${language}: vertical catalog scrolling keeps the page in bounds and rows scroll independently`, async ({
			page
		}) => {
			await page.setViewportSize({ width, height: 844 });
			await page.route('**/*', (route) =>
				new URL(route.request().url()).origin === 'http://localhost:5173'
					? route.continue()
					: route.abort()
			);
			await page.addInitScript((language) => {
				localStorage.setItem('lang', language);
				localStorage.setItem('version', '4');
				localStorage.setItem(
					'userData',
					JSON.stringify({
						degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
						semesters: [[], [], []],
						currentSemester: 0,
						exemptions: [],
						wishlist: [
							'02340124',
							'02340141',
							'02340128',
							'02340129',
							'01040033',
							'01040035'
						]
					})
				);
			}, language);
			await page.goto('/app/catalog');
			const row = page.locator('.catalog-page .course-row').first();
			await expect(row).toBeVisible({ timeout: 20000 });
			await expect(
				page.locator('.console-loading, .catalog-loading, .loading-course')
			).toHaveCount(0);
			await expect(
				page.getByRole('heading', {
					level: 1,
					name: language === 'he' ? 'קטלוג' : 'Catalog',
					exact: true
				})
			).toHaveCount(1);
			// One pixel is enough to give mobile WebKit a horizontal document range.
			const overflow = () =>
				page.evaluate(
					() =>
						document.documentElement.scrollWidth -
						document.documentElement.clientWidth
				);
			expect(await overflow()).toBe(0);
			await page.evaluate(() =>
				scrollBy({ left: 80, top: 400, behavior: 'instant' })
			);
			await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
			expect(await page.evaluate(() => scrollX)).toBe(0);
			// Preserve the intentional horizontal course scroller in both directions.
			await row.evaluate(
				(element, language) =>
					element.scrollBy({
						left: language === 'he' ? -150 : 150,
						behavior: 'instant'
					}),
				language
			);
			await expect
				.poll(() => row.evaluate((element) => Math.abs(element.scrollLeft)))
				.toBeGreaterThan(50);
			expect(await page.evaluate(() => scrollX)).toBe(0);
			expect(await overflow()).toBe(0);
		});
	}
}
