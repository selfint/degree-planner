import {
	devices,
	expect,
	test,
	type Page,
	type CDPSession
} from '@playwright/test';

const courses = {
	'10400001': { code: '10400001', name: 'First course', points: 5 },
	'10400002': { code: '10400002', name: 'Second course', points: 5 },
	'10400003': { code: '10400003', name: 'Wishlist course', points: 5 }
};

async function moveTouch(
	page: Page,
	touch: CDPSession,
	from: { x: number; y: number },
	to: { x: number; y: number }
) {
	// Continuous finger movement also crosses the scroller's narrow edge gutter.
	for (let step = 1; step <= 24; step++) {
		await touch.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [
				{
					x: from.x + ((to.x - from.x) * step) / 24,
					y: from.y + ((to.y - from.y) * step) / 24
				}
			]
		});
		await page.waitForTimeout(40);
	}
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		if (localStorage.getItem('userData')) return;
		localStorage.setItem('lang', 'en');
		localStorage.setItem('version', '4');
		localStorage.setItem(
			'userData',
			JSON.stringify({
				exemptions: [],
				degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
				path: 'CG00006246',
				semesters: [['10400001', '10400002'], [], [], [], [], []],
				currentSemester: 0,
				wishlist: ['10400003']
			})
		);
	});
	await page.route('**/courseDataStripped.json', (route) =>
		route.fulfill({ json: courses })
	);
	// Navigate client-side so the fixture replaces the course-data request,
	// rather than the real catalog being inlined by server-side rendering.
	await page.goto('/');
	await page.locator('a[href="/plan"]').click();
	await expect(page.getByText('First course')).toBeVisible();
});

for (const device of ['Pixel 7', 'iPhone 13']) {
	test.describe(`${device} (Chromium touch emulation)`, () => {
		const { defaultBrowserType: _, ...mobile } = devices[device];
		test.use(mobile);
		for (const language of ['en', 'he']) {
			test(`touch drag stays visible under the finger outside the semester scroller (${language})`, async ({
				page,
				context
			}) => {
				if (language === 'he') {
					await page.locator('footer select').selectOption({ label: 'עב' });
				}
				const card = page.locator('[data-code="10400001"]');
				await card.scrollIntoViewIfNeeded();
				const box = (await card.boundingBox())!;
				const start = {
					x: Math.round(box.x + box.width / 2),
					y: Math.round(box.y + box.height / 2)
				};
				const touch = await context.newCDPSession(page);
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchStart',
					touchPoints: [start]
				});
				// Sortable starts touch drags after its long-press delay.
				await page.waitForTimeout(200);
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchMove',
					touchPoints: [{ x: start.x, y: start.y - 5 }]
				});
				const ghost = page.locator('.sortable-fallback');
				await expect(ghost).toBeVisible();
				await expect(ghost).toHaveCSS(
					'direction',
					language === 'he' ? 'rtl' : 'ltr'
				);

				for (const offset of [-30, -70, -120, -50, -100]) {
					const point = {
						x: start.x + (language === 'he' ? -20 : 20),
						y: start.y + offset
					};
					await touch.send('Input.dispatchTouchEvent', {
						type: 'touchMove',
						touchPoints: [point]
					});
					await expect
						.poll(async () => {
							const rect = (await ghost.boundingBox())!;
							return Math.abs(rect.y + rect.height / 2 - point.y);
						})
						.toBeLessThan(3);
					await expect
						.poll(async () => {
							const rect = (await ghost.boundingBox())!;
							return Math.abs(rect.x + rect.width / 2 - point.x);
						})
						.toBeLessThan(3);
					// A nonzero bounding box alone does not detect overflow clipping.
					await expect
						.poll(() =>
							ghost.evaluate(
								(element) =>
									new Promise<number>((resolve) => {
										const observer = new IntersectionObserver(([entry]) => {
											observer.disconnect();
											resolve(entry.intersectionRatio);
										});
										observer.observe(element);
									})
							)
						)
						.toBeGreaterThan(0.99);
				}
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchEnd',
					touchPoints: []
				});
				await expect(ghost).toHaveCount(0);
				await expect(page.locator('[data-code="10400001"]')).toHaveCount(1);
				await expect(page).toHaveURL(/\/plan$/);
			});
		}

		for (const language of ['en', 'he']) {
			test(`edge dragging scrolls only the course region (${language})`, async ({
				page,
				context
			}) => {
				if (language === 'he') {
					await page.locator('footer select').selectOption({ label: 'עב' });
				}
				const touch = await context.newCDPSession(page);
				const scroller = page.getByTestId('semester-scroller');
				const rect = (await page
					.locator('[data-code="10400001"]')
					.boundingBox())!;
				const start = {
					x: rect.x + rect.width / 2,
					y: rect.y + rect.height / 2
				};
				const viewport = page.viewportSize()!;
				const headerX = (await page.locator('header').boundingBox())!.x;
				const initialScroll = await scroller.evaluate(
					(element) => element.scrollLeft
				);
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchStart',
					touchPoints: [start]
				});
				await page.waitForTimeout(200);
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchMove',
					touchPoints: [{ x: start.x, y: start.y + 5 }]
				});
				await expect(page.locator('.sortable-fallback')).toHaveCount(1);
				const edgeX = language === 'he' ? 4 : viewport.width - 4;
				for (let step = 1; step <= 10; step++) {
					await touch.send('Input.dispatchTouchEvent', {
						type: 'touchMove',
						touchPoints: [
							{ x: start.x + ((edgeX - start.x) * step) / 10, y: start.y + 5 }
						]
					});
					await page.waitForTimeout(30);
				}
				await page.waitForTimeout(700);
				const documentSize = await page.evaluate(() => ({
					width: document.documentElement.scrollWidth,
					x: window.scrollX,
					viewportX: window.visualViewport?.offsetLeft ?? 0
				}));
				expect(documentSize.width).toBeLessThanOrEqual(viewport.width + 1);
				expect(Math.abs(documentSize.x)).toBeLessThan(1);
				expect(Math.abs(documentSize.viewportX)).toBeLessThan(1);
				expect((await page.locator('header').boundingBox())!.x).toBeCloseTo(
					headerX,
					0
				);
				await expect
					.poll(async () =>
						Math.abs(
							(await scroller.evaluate((element) => element.scrollLeft)) -
								initialScroll
						)
					)
					.toBeGreaterThan(30);
				const forwardScroll = await scroller.evaluate(
					(element) => element.scrollLeft
				);
				await moveTouch(
					page,
					touch,
					{ x: edgeX, y: start.y + 5 },
					{
						x: language === 'he' ? viewport.width - 4 : 4,
						y: start.y + 5
					}
				);

				await expect
					.poll(async () =>
						Math.abs(
							(await scroller.evaluate((element) => element.scrollLeft)) -
								initialScroll
						)
					)
					.toBeLessThan(Math.abs(forwardScroll - initialScroll) - 20);
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchEnd',
					touchPoints: []
				});
				await expect(page.locator('.sortable-fallback')).toHaveCount(0);
				await expect(page.locator('[data-plan-drag-overlay]')).toHaveCount(0);
				await expect(page.locator('[data-code]')).toHaveCount(3);
				await page.locator('footer select').selectOption({ label: 'en' });
				const cancel = page.getByRole('button', {
					name: 'Cancel',
					exact: true
				});
				if (await cancel.count()) await cancel.click();
				await expect(
					page.locator('[data-semester="0"] [data-code]')
				).toHaveCount(2);
			});
		}

		for (const language of ['en', 'he']) {
			test(`downward drags do not create blank page space (${language})`, async ({
				page,
				context
			}) => {
				if (language === 'he')
					await page.locator('footer select').selectOption({ label: 'עב' });
				const touch = await context.newCDPSession(page);
				const rect = (await page
					.locator('[data-code="10400001"]')
					.boundingBox())!;
				const start = {
					x: rect.x + rect.width / 2,
					y: rect.y + rect.height / 2
				};
				const before = await page.evaluate(() => ({
					height: document.documentElement.scrollHeight,
					y: window.scrollY
				}));
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchStart',
					touchPoints: [start]
				});
				await page.waitForTimeout(200);
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchMove',
					touchPoints: [{ x: start.x, y: start.y + 5 }]
				});
				await expect(page.locator('.sortable-fallback')).toHaveCount(1);
				const bottom = { x: start.x, y: page.viewportSize()!.height - 4 };
				await moveTouch(page, touch, start, bottom);
				await page.waitForTimeout(1500);
				const after = await page.evaluate(() => ({
					height: document.documentElement.scrollHeight,
					y: window.scrollY,
					viewportY: window.visualViewport?.offsetTop ?? 0
				}));
				expect(after.height).toBeLessThanOrEqual(before.height + 1);
				expect(after.y).toBeLessThanOrEqual(
					Math.max(0, before.height - page.viewportSize()!.height) + 1
				);
				expect(after.viewportY).toBe(0);
				const ghost = (await page.locator('.sortable-fallback').boundingBox())!;
				expect(ghost.y + ghost.height / 2).toBeCloseTo(bottom.y, 0);
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchCancel',
					touchPoints: []
				});
				await expect(page.locator('.sortable-fallback')).toHaveCount(0);
				await expect(page.locator('[data-plan-drag-overlay]')).toHaveCount(0);
				await expect(page.locator('[data-code]')).toHaveCount(3);
			});
		}

		test('one activating touch move immediately positions the preview under the finger', async ({
			page,
			context
		}) => {
			const rect = (await page
				.locator('[data-code="10400001"]')
				.boundingBox())!;
			const start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
			const target = { x: start.x + 30, y: start.y + 100 };
			const touch = await context.newCDPSession(page);
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [start]
			});
			await page.waitForTimeout(200);
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [target]
			});
			await expect(page.locator('.sortable-fallback')).toHaveCount(1);
			await expect
				.poll(async () => {
					const ghost = (await page
						.locator('.sortable-fallback')
						.boundingBox())!;
					return (
						Math.abs(ghost.x + ghost.width / 2 - target.x) +
						Math.abs(ghost.y + ghost.height / 2 - target.y)
					);
				})
				.toBeLessThan(1);
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchCancel',
				touchPoints: []
			});
			await expect(page.locator('[data-plan-drag-overlay]')).toHaveCount(0);
		});

		test('active drags can scroll a long plan in both vertical directions without extending it', async ({
			page,
			context
		}) => {
			await page.evaluate(() => {
				const data = JSON.parse(localStorage.getItem('userData')!);
				data.semesters[0].push(
					...Array.from({ length: 24 }, (_, i) => String(10410000 + i))
				);
				localStorage.setItem('userData', JSON.stringify(data));
			});
			await page.reload();
			const card = page.locator('[data-code="10400001"]');
			await card.scrollIntoViewIfNeeded();
			const rect = (await card.boundingBox())!;
			const start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
			const height = await page.evaluate(
				() => document.documentElement.scrollHeight
			);
			const touch = await context.newCDPSession(page);
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [start]
			});
			await page.waitForTimeout(200);
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x: start.x, y: start.y + 5 }]
			});
			await expect(page.locator('.sortable-fallback')).toHaveCount(1);
			const bottom = { x: start.x, y: page.viewportSize()!.height - 4 };
			await moveTouch(page, touch, start, bottom);
			await expect
				.poll(() => page.evaluate(() => scrollY))
				.toBeGreaterThan(100);
			const downY = await page.evaluate(() => scrollY);
			const ghost = (await page.locator('.sortable-fallback').boundingBox())!;
			expect(ghost.y + ghost.height / 2).toBeCloseTo(bottom.y, 0);
			expect(
				await page.evaluate(() => document.documentElement.scrollHeight)
			).toBeLessThanOrEqual(height + 1);
			await moveTouch(page, touch, bottom, { x: start.x, y: 4 });
			await expect
				.poll(() => page.evaluate(() => scrollY))
				.toBeLessThan(downY - 20);
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchCancel',
				touchPoints: []
			});
			await expect(page.locator('[data-plan-drag-overlay]')).toHaveCount(0);
			await expect(page.locator('.sortable-fallback')).toHaveCount(0);
			await expect(page.locator('[data-plan-drag-overlay]')).toHaveCount(0);
			await expect(page.locator('[data-code]')).toHaveCount(27);
			const stoppedY = await page.evaluate(() => scrollY);
			await page.waitForTimeout(200);
			expect(await page.evaluate(() => scrollY)).toBe(stoppedY);
		});

		test('wishlist edge drags stay inside its scroller in both page directions', async ({
			page,
			context
		}) => {
			const touch = await context.newCDPSession(page);
			for (const language of ['en', 'he']) {
				await page.evaluate((language) => {
					const data = JSON.parse(localStorage.getItem('userData')!);
					data.wishlist = Array.from({ length: 8 }, (_, i) =>
						String(10420000 + i)
					);
					localStorage.setItem('userData', JSON.stringify(data));
					localStorage.setItem('lang', language);
				}, language);
				await page.reload();
				const scroller = page.getByTestId('wishlist-scroller');
				const card = page.locator('[data-code="10420000"]');
				await expect(card).toBeVisible();
				const rect = (await card.boundingBox())!;
				const start = {
					x: rect.x + rect.width / 2,
					y: rect.y + rect.height / 2
				};
				const viewport = page.viewportSize()!;
				const bodyStyle = await page.locator('body').evaluate((element) => ({
					position: getComputedStyle(element).position,
					overflowX: getComputedStyle(element).overflowX
				}));
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchStart',
					touchPoints: [start]
				});
				await page.waitForTimeout(200);
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchMove',
					touchPoints: [{ x: start.x + 5, y: start.y }]
				});
				await expect(page.locator('.sortable-fallback')).toHaveCount(1);
				for (let step = 1; step <= 10; step++) {
					await touch.send('Input.dispatchTouchEvent', {
						type: 'touchMove',
						touchPoints: [
							{
								x: start.x + ((viewport.width - 4 - start.x) * step) / 10,
								y: start.y
							}
						]
					});
					await page.waitForTimeout(30);
				}
				await expect
					.poll(() => scroller.evaluate((element) => element.scrollLeft))
					.toBeGreaterThan(60);
				const forward = await scroller.evaluate(
					(element) => element.scrollLeft
				);
				for (const x of [viewport.width - 4, 4]) {
					if (x === 4) {
						await moveTouch(
							page,
							touch,
							{ x: viewport.width - 4, y: start.y },
							{ x, y: start.y }
						);
					}
					await page.waitForTimeout(300);
					const documentSize = await page.evaluate(() => ({
						width: document.documentElement.scrollWidth,
						x: window.scrollX,
						viewportX: window.visualViewport?.offsetLeft ?? 0
					}));
					expect(documentSize.width).toBeLessThanOrEqual(viewport.width + 1);
					expect(Math.abs(documentSize.x)).toBeLessThan(1);
					expect(Math.abs(documentSize.viewportX)).toBeLessThan(1);
				}
				await expect
					.poll(() => scroller.evaluate((element) => element.scrollLeft))
					.toBeLessThan(forward - 20);
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchEnd',
					touchPoints: []
				});
				await expect(page.locator('.sortable-fallback')).toHaveCount(0);
				await expect(page.locator('[data-plan-drag-overlay]')).toHaveCount(0);
				await expect(page.locator('[data-code]')).toHaveCount(10);
				expect(
					await page.locator('body').evaluate((element) => ({
						position: getComputedStyle(element).position,
						overflowX: getComputedStyle(element).overflowX
					}))
				).toEqual(bodyStyle);
			}
		});

		async function dragTo(
			page: Page,
			touch: CDPSession,
			code: string,
			target: { x: number; y: number }
		) {
			const card = page.locator(`[data-code="${code}"]`);
			const rect = (await card.boundingBox())!;
			const start = {
				x: Math.round(rect.x + rect.width / 2),
				y: Math.round(rect.y + rect.height / 2)
			};
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [start]
			});
			await page.waitForTimeout(200);
			for (let step = 1; step <= 10; step++) {
				await touch.send('Input.dispatchTouchEvent', {
					type: 'touchMove',
					touchPoints: [
						{
							x: start.x + ((target.x - start.x) * step) / 10,
							y: start.y + ((target.y - start.y) * step) / 10
						}
					]
				});
				// Give Sortable's touch hit-testing loop time to enter each drop zone.
				await page.waitForTimeout(30);
			}
			await page.waitForTimeout(150);
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchEnd',
				touchPoints: []
			});
			await expect(page.locator('.sortable-fallback')).toHaveCount(0);
			await expect(page.locator('[data-plan-drag-overlay]')).toHaveCount(0);
			await expect(page.locator(`[data-code="${code}"]`)).toHaveCount(1);
			await expect(page).toHaveURL(/\/plan$/);
		}

		test('repeated touch moves between semesters and the wishlist can be saved or cancelled', async ({
			page,
			context
		}) => {
			const touch = await context.newCDPSession(page);
			const secondSemester = page.locator('[data-semester="1"]');
			const secondRect = (await secondSemester.boundingBox())!;
			await dragTo(page, touch, '10400001', {
				x: secondRect.x + secondRect.width / 2,
				y: secondRect.y + 30
			});
			await expect(
				secondSemester.locator('[data-code="10400001"]')
			).toHaveCount(1);
			await page.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(
				page.getByRole('button', { name: 'Save', exact: true })
			).toHaveCount(0);
			await page.reload();
			await expect(
				secondSemester.locator('[data-code="10400001"]')
			).toHaveCount(1);

			const wishlist = page.getByTestId('plan-wishlist');
			const wishRect = (await wishlist.boundingBox())!;
			await dragTo(page, touch, '10400001', {
				x: wishRect.x + wishRect.width / 2,
				y: wishRect.y + wishRect.height / 2
			});
			await expect(wishlist.locator('[data-code="10400001"]')).toHaveCount(1);
			await page.getByRole('button', { name: 'Cancel', exact: true }).click();
			await expect(
				secondSemester.locator('[data-code="10400001"]')
			).toHaveCount(1);
			await expect(wishlist.locator('[data-code="10400001"]')).toHaveCount(0);

			// The keyed lists have now been recreated several times; another drag must work.
			const firstSemester = page.locator('[data-semester="0"]');
			const firstRect = (await firstSemester.boundingBox())!;
			await dragTo(page, touch, '10400001', {
				x: firstRect.x + firstRect.width / 2,
				y: firstRect.y + 20
			});
			await expect(firstSemester.locator('[data-code="10400001"]')).toHaveCount(
				1
			);
			await expect(page.locator('[data-code]')).toHaveCount(3);
		});

		test('empty and occupied columns accept touch drops at the bottom, including an empty wishlist', async ({
			page,
			context
		}) => {
			const touch = await context.newCDPSession(page);
			const secondSemester = page.locator('[data-semester="1"]');
			const wishlist = page.getByTestId('plan-wishlist');
			const second = (await secondSemester.boundingBox())!;
			expect(second.height).toBeGreaterThan(250);
			const bottom = {
				x: second.x + second.width / 2,
				y: second.y + second.height - 20
			};
			await dragTo(page, touch, '10400003', bottom);
			await expect(
				secondSemester.locator('[data-code="10400003"]')
			).toHaveCount(1);
			await expect(wishlist.locator('[data-code]')).toHaveCount(0);
			await dragTo(page, touch, '10400001', bottom);
			await expect(secondSemester.locator('[data-code]')).toHaveCount(2);
			const emptyWish = (await wishlist.boundingBox())!;
			expect(emptyWish.width).toBeGreaterThan(300);
			expect(emptyWish.height).toBeGreaterThan(80);
			await dragTo(page, touch, '10400002', {
				x: emptyWish.x + 30,
				y: emptyWish.y + emptyWish.height - 12
			});
			await expect(wishlist.locator('[data-code="10400002"]')).toHaveCount(1);
			await page.getByRole('button', { name: 'Save', exact: true }).click();
			await page.reload();
			await expect(secondSemester.locator('[data-code]')).toHaveCount(2);
			await expect(wishlist.locator('[data-code="10400002"]')).toHaveCount(1);
			await expect(page.locator('[data-code]')).toHaveCount(3);
		});

		test('drop zones remain usable on a short mobile screen without a giant scroll area', async ({
			page,
			context
		}) => {
			await page.setViewportSize({ width: 360, height: 540 });
			const touch = await context.newCDPSession(page);
			const secondSemester = page.locator('[data-semester="1"]');
			const rect = (await secondSemester.boundingBox())!;
			expect(rect.height).toBeGreaterThanOrEqual(128);
			expect(rect.y + rect.height).toBeLessThan(540);
			const documentHeight = await page.evaluate(
				() => document.documentElement.scrollHeight
			);
			// A wrapped footer may extend below a short screen; the planner itself
			// must fit without creating another viewport of blank scrolling.
			const footerHeight = (await page.locator('footer').boundingBox())!.height;
			expect(documentHeight).toBeLessThanOrEqual(540 + footerHeight);
			await dragTo(page, touch, '10400001', {
				x: rect.x + rect.width / 2,
				y: rect.y + rect.height - 15
			});
			await expect(
				secondSemester.locator('[data-code="10400001"]')
			).toHaveCount(1);
			await page.getByRole('button', { name: 'Cancel', exact: true }).click();
			await expect(
				page.locator('[data-semester="0"] [data-code="10400001"]')
			).toHaveCount(1);
		});

		test('navigating away during a touch drag removes its preview without losing courses', async ({
			page,
			context
		}) => {
			const rect = (await page
				.locator('[data-code="10400001"]')
				.boundingBox())!;
			const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
			const touch = await context.newCDPSession(page);
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [point]
			});
			await page.waitForTimeout(200);
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x: point.x, y: point.y - 5 }]
			});
			await expect(page.locator('.sortable-fallback')).toHaveCount(1);
			const lastCard = (await page
				.locator('[data-code="10400002"]')
				.boundingBox())!;
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x: point.x, y: lastCard.y + lastCard.height + 20 }]
			});
			// Let normal drag-over hit testing finish before interrupting the gesture.
			await page.waitForTimeout(150);
			// Browser Back unmounts the plan without ending the gesture first.
			await page.goBack();
			await expect(page).toHaveURL(/\/$/);
			await expect(page.locator('.sortable-fallback')).toHaveCount(0);
			await expect(page.locator('[data-plan-drag-overlay]')).toHaveCount(0);
			await touch.send('Input.dispatchTouchEvent', {
				type: 'touchCancel',
				touchPoints: []
			});
			await page.locator('a[href="/plan"]').click();
			await expect(page).toHaveURL(/\/plan$/);
			await expect(page.locator('[data-code]')).toHaveCount(3);
		});

		test('long semesters grow their drop zones with the course list', async ({
			page,
			context
		}) => {
			await page.evaluate(() => {
				const data = JSON.parse(localStorage.getItem('userData')!);
				data.semesters[0].push(
					...Array.from({ length: 24 }, (_, i) => String(10410000 + i))
				);
				localStorage.setItem('userData', JSON.stringify(data));
			});
			await page.reload();
			const lastCard = page.locator('[data-code="10410023"]');
			await lastCard.scrollIntoViewIfNeeded();
			const first = (await page.locator('[data-semester="0"]').boundingBox())!;
			const secondSemester = page.locator('[data-semester="1"]');
			const second = (await secondSemester.boundingBox())!;
			const last = (await lastCard.boundingBox())!;
			expect(first.height).toBeGreaterThan(page.viewportSize()!.height);
			expect(second.height).toBeCloseTo(first.height, 0);
			expect(last.y + last.height).toBeLessThanOrEqual(
				first.y + first.height + 1
			);
			const touch = await context.newCDPSession(page);
			await dragTo(page, touch, '10410023', {
				x: second.x + second.width / 2,
				y: last.y + last.height / 2
			});
			await expect(
				secondSemester.locator('[data-code="10410023"]')
			).toHaveCount(1);
			await expect(page.locator('[data-code]')).toHaveCount(27);
			await page.getByRole('button', { name: 'Cancel', exact: true }).click();
			await expect(
				page.locator('[data-semester="0"] [data-code="10410023"]')
			).toHaveCount(1);
		});

		test('dropping a touch drag outside the lists preserves the course', async ({
			page,
			context
		}) => {
			const touch = await context.newCDPSession(page);
			await dragTo(page, touch, '10400001', { x: 200, y: 20 });
			await expect(page.locator('[data-code="10400001"]')).toHaveCount(1);
			await expect(page.locator('[data-code]')).toHaveCount(3);
		});
	});
}

test.describe('mouse drop zones', () => {
	test.use({
		viewport: { width: 1280, height: 800 },
		hasTouch: false,
		isMobile: false
	});
	test('empty semesters and the empty wishlist accept mouse drops throughout their area', async ({
		page
	}) => {
		const secondSemester = page.locator('[data-semester="1"]');
		const wishlist = page.getByTestId('plan-wishlist');
		const second = (await secondSemester.boundingBox())!;
		expect(second.height).toBeGreaterThan(250);
		await page.locator('[data-code="10400003"]').dragTo(secondSemester, {
			targetPosition: { x: second.width / 2, y: second.height - 20 }
		});
		await expect(secondSemester.locator('[data-code="10400003"]')).toHaveCount(
			1
		);
		await page.locator('[data-code="10400001"]').dragTo(secondSemester, {
			targetPosition: { x: second.width / 2, y: second.height - 20 }
		});
		await expect(secondSemester.locator('[data-code]')).toHaveCount(2);
		const emptyWish = (await wishlist.boundingBox())!;
		expect(emptyWish.width).toBeGreaterThan(1200);
		expect(emptyWish.height).toBeGreaterThan(60);
		await page.locator('[data-code="10400002"]').dragTo(wishlist, {
			targetPosition: { x: 40, y: emptyWish.height - 10 }
		});
		await expect(wishlist.locator('[data-code="10400002"]')).toHaveCount(1);
		await page.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(page.locator('[data-semester="0"] [data-code]')).toHaveCount(
			2
		);
		await expect(wishlist.locator('[data-code="10400003"]')).toHaveCount(1);
	});
});
