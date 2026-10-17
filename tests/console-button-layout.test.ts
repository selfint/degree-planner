import { expect, test, type Locator, type Page } from '@playwright/test';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
// Fictional records exercise real routes, without altering production data.
const course = {
	code: '10400001',
	name: 'Button layout fixture',
	points: 5,
	median: 80,
	current: true,
	connections: { dependencies: [], adjacent: [], exclusive: [] }
};

async function expectCompactButtons(page: Page, buttons: Locator) {
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	expect(await buttons.count()).toBeGreaterThan(0);
	for (const button of await buttons.all()) {
		await button.scrollIntoViewIfNeeded();
		const box = await button.evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			const rootSize = parseFloat(
				getComputedStyle(document.documentElement).fontSize
			);
			const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
			const textRects: DOMRect[] = [];
			while (walker.nextNode()) {
				const node = walker.currentNode;
				if (
					!node.textContent?.trim() ||
					node.parentElement?.closest('.sr-only, [aria-hidden="true"]')
				)
					continue;
				const range = document.createRange();
				range.selectNodeContents(node);
				textRects.push(...Array.from(range.getClientRects()));
			}
			return {
				label: element.textContent?.trim(),
				height: bounds.height / rootSize,
				whiteSpace: style.whiteSpace,
				left: bounds.left,
				right: bounds.right,
				viewport: innerWidth,
				overflow: element.scrollWidth - element.clientWidth,
				lineTops: [...new Set(textRects.map((rect) => Math.round(rect.top)))],
				textFits: textRects.every(
					(rect) => rect.left >= bounds.left && rect.right <= bounds.right
				)
			};
		});
		expect(box.height, box.label).toBeCloseTo(2.25, 2);
		expect(box.whiteSpace, box.label).toBe('nowrap');
		expect(box.lineTops.length, box.label).toBe(1);
		expect(box.textFits, box.label).toBe(true);
		expect(box.overflow, box.label).toBeLessThanOrEqual(1);
		expect(box.left, box.label).toBeGreaterThanOrEqual(0);
		expect(box.right, box.label).toBeLessThanOrEqual(box.viewport);
	}
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth)
	).toBeLessThanOrEqual(page.viewportSize()!.width);
}

for (const width of [320, 390]) {
	for (const language of ['en', 'he']) {
		test.describe(`${width}px ${language} console buttons`, () => {
			test.use({
				viewport: { width, height: 664 },
				isMobile: true,
				hasTouch: true
			});

			test('keep complete single-line labels at one height across real routes', async ({
				page
			}) => {
				await page.addInitScript((language) => {
					if (!localStorage.getItem('userData')) {
						localStorage.setItem('lang', language);
						localStorage.setItem('version', '4');
						localStorage.setItem(
							'userData',
							JSON.stringify({
								degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
								path: 'CG00006246',
								semesters: Array.from({ length: 15 }, () => []),
								currentSemester: 12,
								exemptions: [],
								wishlist: []
							})
						);
					}
					// Exercise the actual unavailable-install UI with a rejected platform
					// operation, rather than forcing a view prop or Storybook variant.
					if ('serviceWorker' in navigator)
						navigator.serviceWorker.register = () =>
							Promise.reject(
								new DOMException(
									'Fixture denies offline installation',
									'NotSupportedError'
								)
							);
				}, language);
				await page.route(/\/courseData(?:Stripped)?\.json(?:\?.*)?$/, (route) =>
					route.fulfill({ json: { [course.code]: course } })
				);
				await page.route(`**/_courses/${course.code}`, (route) =>
					route.fulfill({ json: course })
				);

				await page.goto(`${origin}/app/course/${course.code}`);
				await expect(page.locator('h1.course-name')).toHaveText(course.name);
				const actions = page.getByTestId('course-plan-actions');
				await expect(actions).toBeVisible();
				await expectCompactButtons(page, actions.locator('button.ui-button'));
				await actions
					.getByRole('button', {
						name: language === 'en' ? 'Plan' : 'הוספה',
						exact: true
					})
					.tap();
				const removeLabel =
					language === 'en'
						? 'Remove from semester Winter 5'
						: 'הסר מהסמסטר חורף 5';
				await expect(
					actions.getByRole('button', { name: removeLabel, exact: true })
				).toBeVisible();
				await expectCompactButtons(page, actions.locator('button.ui-button'));

				await page.goto(`${origin}/app/settings`);
				const semester = page.locator('.semester-field').first();
				await semester.locator('select').selectOption('13');
				await expect(semester.locator('.field-actions button')).toHaveCount(2);
				await expectCompactButtons(page, page.locator('main button.ui-button'));
				await semester
					.getByRole('button', {
						name: language === 'en' ? 'Cancel' : 'בטל',
						exact: true
					})
					.tap();
				await expect(semester.locator('select')).toHaveValue('12');

				await page.goto(`${origin}/app/search?q=layout`);
				await page.locator('details.search-filters summary').tap();
				await expectCompactButtons(
					page,
					page.locator('details.search-filters button.ui-button')
				);

				const status = page.locator('details.pwa-details');
				await expect(status.locator('summary')).toBeVisible();
				await status.locator('summary').tap();
				await expect(status.locator('.pwa-actions button')).toHaveCount(2);
				await expectCompactButtons(page, status.locator('.pwa-actions button'));
			});
		});
	}
}
