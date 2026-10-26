import { expectSearchFiltersVisible } from './helpers/searchFilters';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { pwaMessages } from '../src/lib/pwa/messages';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
// Fictional records exercise real routes, without altering production data.
const course = {
	code: '10400001',
	name: 'Button layout fixture',
	about:
		'A short course description that is always available before plan actions.',
	points: 5,
	median: 80,
	current: true,
	connections: { dependencies: [], adjacent: [], exclusive: [] }
};

async function expectNoDocumentOverflow(page: Page) {
	const layout = await page.evaluate(() => {
		const width = document.documentElement.scrollWidth;
		return {
			width,
			overflowing: [...document.querySelectorAll<HTMLElement>('body *')]
				.filter((element) => {
					const rect = element.getBoundingClientRect();
					return (
						rect.width > 0 &&
						rect.height > 0 &&
						(rect.left < 0 ||
							rect.right > innerWidth ||
							element.scrollWidth > element.clientWidth)
					);
				})
				.map((element) => {
					const rect = element.getBoundingClientRect();
					return {
						tag: element.tagName,
						class: element.className,
						left: rect.left,
						right: rect.right,
						clientWidth: element.clientWidth,
						scrollWidth: element.scrollWidth,
						overflowX: getComputedStyle(element).overflowX
					};
				})
		};
	});
	expect(layout.width, JSON.stringify(layout.overflowing)).toBeLessThanOrEqual(
		page.viewportSize()!.width
	);
}

async function expectSingleRowHeader(page: Page, language: string) {
	const header = page.locator('header.title-bar');
	await expect(header).toHaveAttribute('dir', 'ltr');
	await expect(header.locator('form[role="search"]')).toHaveAttribute(
		'dir',
		language === 'he' ? 'rtl' : 'ltr'
	);
	await expect(header.getByTestId('pwa-status')).toHaveCount(0);
	await expect(header.getByTestId('pwa-error')).toHaveCount(0);
	const layout = await header.evaluate((el) => {
		const header = el.getBoundingClientRect();
		return {
			height: header.height,
			center: header.top + header.height / 2,
			items: ['.brand', '.header-search', 'nav'].map((selector) => {
				const r = el.querySelector(selector)!.getBoundingClientRect();
				return { left: r.left, right: r.right, center: r.top + r.height / 2 };
			})
		};
	});
	expect(layout.height).toBe(48);
	for (const item of layout.items) {
		expect(item.center).toBeCloseTo(layout.center, 1);
		expect(item.left).toBeGreaterThanOrEqual(0);
		expect(item.right).toBeLessThanOrEqual(page.viewportSize()!.width);
	}
	expect(layout.items[0].right).toBeLessThanOrEqual(layout.items[1].left);
	expect(layout.items[1].right).toBeLessThanOrEqual(layout.items[2].left);
}

async function expectWithinViewport(page: Page, controls: Locator) {
	for (const control of await controls.all()) {
		const box = await control.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
	}
	await expectNoDocumentOverflow(page);
}

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
	await expectNoDocumentOverflow(page);
}

for (const width of [320, 390]) {
	for (const language of ['en', 'he'] as const) {
		test.describe(`${width}px ${language} console buttons`, () => {
			test.use({
				viewport: { width, height: 664 },
				isMobile: true,
				hasTouch: true
			});

			test('keep complete single-line labels at one height across real routes', async ({
				page
			}) => {
				const text = pwaMessages[language];
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
						navigator.serviceWorker.register = () => {
							const root = document.documentElement;
							root.dataset.registrationAttempts = String(
								Number(root.dataset.registrationAttempts ?? 0) + 1
							);
							return Promise.reject(
								new DOMException(
									'Fixture denies offline installation',
									'NotSupportedError'
								)
							);
						};
				}, language);
				await page.route(/\/courseData(?:Stripped)?\.json(?:\?.*)?$/, (route) =>
					route.fulfill({ json: { [course.code]: course } })
				);
				await page.route(`**/_courses/${course.code}`, (route) =>
					route.fulfill({ json: course })
				);

				await page.goto(`${origin}/app/course/${course.code}`);
				await expect(page.locator('h1.course-name')).toHaveText(course.name);
				await expectSingleRowHeader(page, language);
				const actions = page.getByTestId('course-plan-actions');
				await expect(actions).toBeVisible();
				const description = page.locator('.course-description');
				await expect(description).toBeVisible();
				await expect(description).toContainText(course.about);
				await expect(page.locator('details.course-description')).toHaveCount(0);
				const descriptionBounds = await description.boundingBox();
				const actionsBounds = await actions.boundingBox();
				expect(
					descriptionBounds!.y + descriptionBounds!.height
				).toBeLessThanOrEqual(actionsBounds!.y);
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
				const degreeSelect = page.getByRole('combobox', {
					name: language === 'en' ? 'Degree' : 'תואר',
					exact: true
				});
				await expect(degreeSelect).toHaveValue('SC00001320_CG00006382');
				const selectedDegree = await degreeSelect
					.locator('option:checked')
					.textContent();
				await expectWithinViewport(page, page.locator('main select'));
				// Keep the native control in keyboard tab order. Its external focus
				// ring must remain visible outside the closed-value containment box.
				for (let tab = 0; tab < 20; tab++) {
					await page.keyboard.press('Tab');
					if (
						await degreeSelect.evaluate(
							(select) => select === document.activeElement
						)
					)
						break;
				}
				await expect(degreeSelect).toBeFocused();
				const focus = await degreeSelect.evaluate((select) => {
					const frame = select.parentElement!;
					const style = getComputedStyle(frame);
					return {
						visible: select.matches(':focus-visible'),
						outlineStyle: style.outlineStyle,
						outlineWidth: parseFloat(style.outlineWidth),
						outlineOffset: parseFloat(style.outlineOffset),
						outlineColor: style.outlineColor
					};
				});
				expect(focus.visible).toBe(true);
				expect(focus.outlineStyle).toBe('solid');
				expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
				expect(focus.outlineOffset).toBeGreaterThanOrEqual(0);
				expect(focus.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
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
				await expect(degreeSelect.locator('option:checked')).toHaveText(
					selectedDegree!
				);
				await expectWithinViewport(page, page.locator('main select'));

				await page.goto(`${origin}/app/search?q=layout`);
				await expectSearchFiltersVisible(page);
				await expectCompactButtons(
					page,
					page.locator('fieldset.search-filters button.ui-button')
				);

				await expectSingleRowHeader(page, language);
				const footer = page.locator('footer');
				const pwaRow = footer.getByTestId('pwa-footer-row');
				const status = pwaRow.getByTestId('pwa-error');
				await expect(pwaRow).toBeVisible();
				const originalControls = await footer
					.locator(':scope > div')
					.first()
					.boundingBox();
				const pwaBounds = await pwaRow.boundingBox();
				expect(pwaBounds!.y).toBeGreaterThanOrEqual(
					originalControls!.y + originalControls!.height
				);
				await expect(page.getByTestId('pwa-install-help')).toHaveCount(0);
				await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
				const retry = status.getByRole('button', {
					name: text.retry,
					exact: true
				});
				const indicator = status.getByRole('button', {
					name: text.errorDetails,
					exact: true
				});
				const details = pwaRow.getByTestId('pwa-status-details');
				await expect(status).toBeVisible();
				await expect(indicator).toHaveAttribute(
					'aria-controls',
					'offline-status'
				);
				await expect(indicator).toHaveAttribute('aria-expanded', 'false');
				await expect(details).toBeHidden();
				await expect(page.locator('details.pwa-details')).toHaveCount(0);
				await expectCompactButtons(page, retry);
				await expect(retry).toHaveCSS('border-top-width', '0px');
				await expect(retry).toHaveCSS('text-decoration-line', 'underline');
				await expectWithinViewport(page, page.locator('header nav'));
				const documentIdentity = await page.evaluateHandle(() => document);
				for (let attempt = 0; attempt < 2; attempt++) {
					const attempts = await page
						.locator('html')
						.getAttribute('data-registration-attempts');
					await retry.tap();
					await expect
						.poll(async () =>
							Number(
								await page
									.locator('html')
									.getAttribute('data-registration-attempts')
							)
						)
						.toBeGreaterThan(Number(attempts));
					await indicator.focus();
					await indicator.press('Enter');
					await expect(indicator).toBeFocused();
					await expect(indicator).toHaveAttribute('aria-expanded', 'true');
					await expect(page).toHaveURL(`${origin}/app/search?q=layout`);
					await expect(details).toBeVisible();
					await details.scrollIntoViewIfNeeded();
					await expect(details).toBeInViewport();
					await expect(details).toContainText(text.shellErrors.registration);
					await expect(details).not.toContainText(
						'Fixture denies offline installation'
					);
					await expect(details).toHaveCSS(
						'direction',
						language === 'he' ? 'rtl' : 'ltr'
					);
					await expect(pwaRow.getByTestId('pwa-status')).not.toHaveAttribute(
						'data-state',
						'ready'
					);
					await expect(details.locator('details, summary')).toHaveCount(0);
					await expectWithinViewport(page, details);
					expect(
						await page.evaluate(
							(original) => document === original,
							documentIdentity
						)
					).toBe(true);
					await expectNoDocumentOverflow(page);
					await indicator.focus();
					await indicator.press('Space');
					await expect(indicator).toBeFocused();
					await expect(indicator).toHaveAttribute('aria-expanded', 'false');
					await expect(details).toBeHidden();
				}
				await documentIdentity.dispose();
			});
		});
	}
}
