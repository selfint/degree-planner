import { expect, test, type Page } from '@playwright/test';
import { initializeGuestStorage } from './helpers/student-guest-storage';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;
const code = '10400001';
const canonicalCode = '10400002';
const summary = {
	code,
	name: 'Delayed course details',
	faculty: 'Fixture faculty',
	points: 5,
	current: true,
	connections: { dependencies: [], adjacent: [], exclusive: [] }
};
const about =
	'This course description arrives after the student has started selecting a plan action. ' +
	'Its additional lines must not move an enabled button away from the pointer during a click. '.repeat(
		4
	);

async function wishlist(page: Page): Promise<string[]> {
	return page.evaluate(
		() => JSON.parse(localStorage.getItem('userData')!).wishlist
	);
}

for (const mobile of [false, true]) {
	test.describe(
		mobile ? 'mobile course actions' : 'desktop course actions',
		() => {
			test.use({
				viewport: mobile
					? { width: 390, height: 844 }
					: { width: 1280, height: 900 },
				isMobile: mobile,
				hasTouch: mobile,
				serviceWorkers: 'block'
			});

			for (const language of ['en', 'he'] as const) {
				test(`${language}: delayed details cannot swallow a wishlist click`, async ({
					page,
					context
				}) => {
					await context.addInitScript(initializeGuestStorage, {
						origin,
						language,
						seed: {
							semesters: [[]],
							currentSemester: 0,
							exemptions: [],
							wishlist: []
						}
					});
					// No real authentication, analytics, or user-plan traffic.
					await context.route('**/*', (route) =>
						new URL(route.request().url()).origin === origin
							? route.continue()
							: route.abort('blockedbyclient')
					);
					await context.route(
						/\/courseData(?:Stripped)?\.json(?:\?.*)?$/,
						// The target is an old/shared ID absent from the canonical catalog.
						// Otherwise loadPublicJson satisfies it from IndexedDB without
						// requesting the individual endpoint controlled below.
						(route) =>
							route.fulfill({
								json: {
									[canonicalCode]: { ...summary, code: canonicalCode }
								}
							})
					);

					let releaseDetails!: () => void;
					const heldDetails = new Promise<void>((resolve) => {
						releaseDetails = resolve;
					});
					let detailsRequested = false;
					await context.route(`**/_courses/${code}`, async (route) => {
						detailsRequested = true;
						await heldDetails;
						await route.fulfill({ json: { ...summary, about } });
					});

					try {
						// Enter through the hydrated app, so absent actions cannot be
						// mistaken for a valid loading gate during initial plan startup.
						await page.goto(`${origin}/app/plan`);
						await expect(page.locator('#console-boot')).toBeHidden();
						await expect(page.getByTestId('plan-wishlist')).toBeVisible();
						// Simulate opening an old shared-course link through the real
						// SvelteKit router, without altering application or cache code.
						const timeOrigin = await page.evaluate((code) => {
							const link = document.createElement('a');
							link.href = `/app/course/${code}`;
							link.textContent = 'Open shared course fixture';
							link.setAttribute('data-sveltekit-preload-data', 'off');
							document.querySelector('main')!.prepend(link);
							return performance.timeOrigin;
						}, code);
						await page
							.getByRole('link', { name: 'Open shared course fixture' })
							.click();
						expect(await page.evaluate(() => performance.timeOrigin)).toBe(
							timeOrigin
						);
						await expect(page).toHaveURL(`${origin}/app/course/${code}`);
						await expect.poll(() => detailsRequested).toBe(true);
						await expect(page.locator('h1.course-name')).toHaveText(code);
						await expect(page.locator('.course-loading').first()).toBeVisible();
						await expect(
							page.getByTestId('course-plan-unavailable')
						).toBeHidden();

						const wish = page
							.getByTestId('course-plan-actions')
							.getByRole('button', {
								name: language === 'en' ? 'Wish list' : 'רשימת משאלות',
								exact: true
							});
						// Count persisted additions, not only the deduplicated final array.
						await page.evaluate((code) => {
							document.documentElement.dataset.wishlistWrites = '0';
							const original = Storage.prototype.setItem;
							Storage.prototype.setItem = function (key, value) {
								if (
									this === localStorage &&
									key === 'userData' &&
									JSON.parse(value).wishlist?.includes(code)
								) {
									const root = document.documentElement;
									root.dataset.wishlistWrites = String(
										Number(root.dataset.wishlistWrites) + 1
									);
								}
								return original.call(this, key, value);
							};
						}, code);

						const actionable =
							(await wish.isVisible()) && (await wish.isEnabled());
						if (actionable) {
							await wish.scrollIntoViewIfNeeded();
							const before = (await wish.boundingBox())!;
							const x = before.x + before.width / 2;
							const y = before.y + before.height / 2;
							// Use the same trusted mouse events as Locator.click, including
							// on mobile WebKit. Never let auto-wait re-aim after details load.
							await page.mouse.move(x, y);
							await page.mouse.down();
							releaseDetails();
							await expect(page.locator('.course-description')).toHaveText(
								about
							);
							const after = (await wish.boundingBox())!;
							await page.mouse.up();
							expect
								.soft(Math.abs(after.x - before.x), 'Wish moved horizontally')
								.toBeLessThanOrEqual(1);
							expect
								.soft(Math.abs(after.y - before.y), 'Wish moved vertically')
								.toBeLessThanOrEqual(1);
						} else {
							// Hiding or disabling actions until details settle is equally safe.
							expect(await wishlist(page)).toEqual([]);
							releaseDetails();
							await expect(page.locator('.course-description')).toHaveText(
								about
							);
							await expect(wish).toBeEnabled();
							await wish.click();
						}

						await expect.poll(() => wishlist(page)).toEqual([code]);
						await expect(page.locator('html')).toHaveAttribute(
							'data-wishlist-writes',
							'1'
						);
						await page.reload();
						await expect(page.locator('h1.course-name')).toHaveText(
							summary.name
						);
						await expect(page.locator('#console-boot')).toBeHidden();
						await expect.poll(() => wishlist(page)).toEqual([code]);
						await expect(wish).toHaveCount(0);
					} finally {
						// Also release intercepted requests when an earlier assertion fails.
						releaseDetails();
					}
				});
			}
		}
	);
}
