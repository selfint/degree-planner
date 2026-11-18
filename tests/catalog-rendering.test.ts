import { expect, test } from '@playwright/test';

// Snapshotting every node of the retained catalog forces expensive hidden-tree
// layout in WebKit. Keep action traces, screenshots and source capture; the
// live assertions below still exercise all navigation, focus and layout states.
test.use({
	trace: {
		mode: 'retain-on-failure',
		snapshots: false,
		screenshots: true,
		sources: true
	}
});

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const guest = {
	degree: ['2021_200', '00002120', 'SC00001313_CG00004522'],
	semesters: [[], [], []],
	currentSemester: 0,
	exemptions: [],
	wishlist: []
};

for (const language of ['en', 'he'])
	test(`heavy ${language} catalog constructs each card once and keeps all courses available`, async ({
		page
	}) => {
		// This multi-route journey snapshots all 827 cards when tracing is enabled.
		// Allow that diagnostic overhead; timings are measured separately by the probe.
		test.setTimeout(60_000);
		await page.route('**/*', (route) =>
			new URL(route.request().url()).origin === origin
				? route.continue()
				: route.abort()
		);
		await page.addInitScript(
			({ guest, language }) => {
				localStorage.setItem('lang', language);
				localStorage.setItem('version', '4');
				localStorage.setItem('userData', JSON.stringify(guest));
			},
			{ guest, language }
		);
		await page.goto(origin + '/app/plan');
		await expect(page.locator('.console-shell')).not.toHaveAttribute('inert');
		await page.evaluate(() => {
			const cards = new Set<Element>();
			const observer = new MutationObserver((records) => {
				for (const record of records)
					for (const node of record.addedNodes) {
						if (!(node instanceof Element) || !node.closest('.catalog-page'))
							continue;
						if (node.matches('.course-card')) cards.add(node);
						for (const card of node.querySelectorAll('.course-card'))
							cards.add(card);
					}
			});
			observer.observe(document.body, { subtree: true, childList: true });
			Object.assign(window, { catalogCards: cards, catalogObserver: observer });
		});
		await page.locator('a[href="/app/catalog"]:visible').first().click();
		await expect(page.locator('.catalog-page .course-card')).toHaveCount(827);
		await expect(
			page.locator(
				'.catalog-page .catalog-loading, .catalog-page .course-loading'
			)
		).toHaveCount(0);
		expect(
			await page.evaluate(
				() =>
					(window as unknown as { catalogCards: Set<Element> }).catalogCards
						.size
			)
		).toBe(827);
		await expect(page.locator('.catalog-section .course-row')).toHaveCount(59);
		const firstCard = await page
			.locator('.catalog-page .course-card')
			.first()
			.elementHandle();
		await page.locator('a[href="/app/plan"]:visible').first().click();
		// WebKit retains descendant rectangles under content-visibility:hidden.
		// Wait in the browser: tracing this large hidden tree can outlast an outer
		// expect.poll deadline before its locator evaluation even starts.
		await page.waitForFunction(() => {
			const catalog = document.querySelector('.catalog-page');
			return catalog !== null && !catalog.checkVisibility();
		});
		await expect(page.locator('[data-catalog-cache]')).toHaveCSS(
			'height',
			'0px'
		);
		await expect(page.locator('.catalog-page').getByRole('link')).toHaveCount(
			0
		);
		expect(await firstCard!.evaluate((card) => card.isConnected)).toBe(true);
		await firstCard!.evaluate((card) => card.closest('a')!.focus());
		expect(
			await firstCard!.evaluate(
				(card) => card.closest('a') === document.activeElement
			)
		).toBe(false);
		await page.locator('a[href="/app/catalog"]:visible').first().click();
		await expect(page.locator('.catalog-page')).toBeVisible();
		// Retained DOM alone is insufficient: the returned page must expose a real
		// course in the visible viewport after the browser resumes skipped layout.
		await expect(
			page.locator('.catalog-page .course-name').first()
		).toBeInViewport();
		expect(
			await firstCard!.evaluate(
				(card) => card === document.querySelector('.catalog-page .course-card')
			)
		).toBe(true);
		// Estimated offscreen section heights used to shrink during a WebKit press,
		// moving the course away between pointer-down and pointer-up.
		const courseLink = page
			.locator('.catalog-page a[href="/app/course/02340124"]')
			.first();
		const sectionHeights = () =>
			courseLink.evaluate((link) => {
				const sections = Array.from(
					document.querySelectorAll('.catalog-section')
				);
				return sections
					.slice(0, sections.indexOf(link.closest('section')!) + 1)
					.map((section) => section.getBoundingClientRect().height);
			});
		const offscreenHeights = await sectionHeights();
		await courseLink.scrollIntoViewIfNeeded();
		await page.evaluate(
			() =>
				new Promise<void>((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
				)
		);
		expect(await sectionHeights()).toEqual(offscreenHeights);
		// Mutating the real guest plan on another route must update the retained
		// catalog, rather than preserving a stale screenshot or HTML snapshot.
		await page
			.locator('.catalog-page a[href="/app/course/02340124"]')
			.first()
			.click();
		await expect(page).toHaveURL(origin + '/app/course/02340124');
		await page
			.getByTestId('course-plan-actions')
			.getByRole('button', {
				name: language === 'en' ? 'Wish list' : 'רשימת משאלות',
				exact: true
			})
			.click();
		await page.locator('a[href="/app/catalog"]:visible').first().click();
		await expect(page.locator('.catalog-page .course-card')).toHaveCount(828);
		await expect(
			page.locator('.catalog-section').first().locator('.course-code')
		).toHaveText('02340124');
		await expect(
			page.locator('.catalog-section').first().locator('.course-note')
		).toContainText('🌟');
		// The smaller degree row must react too, not just the separate wishlist.
		const degreeLink = page
			.locator('.catalog-course-row a[href="/app/course/02340124"]')
			.first();
		await expect(degreeLink.locator('.course-note')).toContainText('🌟');
		await expect(degreeLink).toHaveAccessibleName(
			new RegExp(language === 'en' ? 'Wish' : 'משאלות', 'i')
		);

		// Offscreen groups retain real links and native focus/scroll.
		const lastLink = page.locator('.catalog-section .course-row a').last();
		await lastLink.focus();
		await expect(lastLink).toBeFocused();
		await expect(lastLink).toBeInViewport();
		await expect(lastLink.locator('.course-name')).not.toBeEmpty();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth
			)
		).toBe(true);
		const orders = await page
			.locator('.catalog-section .course-row')
			.evaluateAll((rows) =>
				rows.map((row) =>
					Array.from(row.querySelectorAll<HTMLElement>('[data-code]')).map(
						(card) => ({
							code: card.dataset.code!,
							median: Number(
								card
									.querySelector('.course-median')
									?.textContent?.replace(/[^0-9.]/g, '') ?? 0
							)
						})
					)
				)
			);
		expect(orders.reduce((total, row) => total + row.length, 0)).toBe(828);
		for (const row of orders)
			expect(row).toEqual(
				[...row].sort(
					(a, b) => b.median - a.median || a.code.localeCompare(b.code)
				)
			);
	});

for (const language of ['en', 'he'])
	test(`heavy ${language} catalog keeps geometry through resize, find and history`, async ({
		page
	}) => {
		test.setTimeout(90_000);
		await page.route('**/*', (route) =>
			new URL(route.request().url()).origin === origin
				? route.continue()
				: route.abort()
		);
		await page.addInitScript(
			({ guest, language }) => {
				localStorage.setItem('lang', language);
				localStorage.setItem('version', '4');
				localStorage.setItem('userData', JSON.stringify(guest));
			},
			{ guest, language }
		);
		await page.goto(origin + '/app/plan');
		await expect(page.locator('.console-shell')).not.toHaveAttribute('inert');
		await page.locator('a[href="/app/catalog"]:visible').first().click();
		await expect(page.locator('.catalog-page .course-card')).toHaveCount(827);
		await expect(
			page.locator(
				'.catalog-page .catalog-loading, .catalog-page .course-loading'
			)
		).toHaveCount(0);
		for (const width of [320, 390, 1280]) {
			await page.setViewportSize({ width, height: 844 });
			await page.evaluate(() => document.fonts.ready);
			const heights = () =>
				page
					.locator('.catalog-section')
					.evaluateAll((sections) =>
						sections.map((section) => section.getBoundingClientRect().height)
					);
			const before = await heights();
			const last = page.locator('.catalog-section .course-row a').last();
			await last.focus();
			await expect(last).toBeFocused();
			await expect(last).toBeInViewport();
			await page.evaluate(
				() =>
					new Promise((resolve) =>
						requestAnimationFrame(() => requestAnimationFrame(resolve))
					)
			);
			expect(await heights()).toEqual(before);
			// A focused rail must expose its text without clipping names/codes vertically.
			const geometry = await last.evaluate((link) => {
				const row = link.closest('.course-row')!.getBoundingClientRect();
				const code = link
					.querySelector('.course-code')!
					.getBoundingClientRect();
				return { rowBottom: row.bottom, codeBottom: code.bottom };
			});
			expect(geometry.codeBottom).toBeLessThanOrEqual(geometry.rowBottom);
		}
		await page.locator('a[href="/app/plan"]:visible').first().click();
		await expect(page).toHaveURL(origin + '/app/plan');
		await page.goBack();
		await expect(page).toHaveURL(origin + '/app/catalog');
		await expect(page.locator('.catalog-page')).toBeVisible();
		await page.goForward();
		await expect(page).toHaveURL(origin + '/app/plan');
		await expect(page.locator('[data-catalog-cache]')).toHaveAttribute('inert');
		for (let repeat = 0; repeat < 3; repeat++) {
			await page.locator('a[href="/app/catalog"]:visible').first().click();
			await expect(page).toHaveURL(origin + '/app/catalog');
			await page.locator('a[href="/app/plan"]:visible').first().click();
			await expect(page).toHaveURL(origin + '/app/plan');
			await expect(page.locator('[data-catalog-cache]')).toHaveAttribute(
				'inert'
			);
		}
		await page.locator('a[href="/app/catalog"]:visible').first().click();
		await expect(page).toHaveURL(origin + '/app/catalog');
		await expect(page.locator('[data-catalog-cache]')).not.toHaveAttribute(
			'inert'
		);
		await page.evaluate(
			() =>
				new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve))
				)
		);
		// Exercise native find-in-page traversal, including content skipped by CSS.
		const name = await page
			.locator('.catalog-section .course-name')
			.last()
			.textContent();
		expect(
			await page.evaluate((name) => {
				const nativeWindow = window as unknown as {
					find(
						text: string,
						caseSensitive: boolean,
						backwards: boolean,
						wrap: boolean
					): boolean;
				};
				return nativeWindow.find(name!, false, true, true);
			}, name)
		).toBe(true);
		await expect
			.poll(() =>
				page
					.locator('.catalog-section .course-name')
					.filter({ hasText: name! })
					.evaluateAll((names) =>
						names.some((name) => {
							const box = name.getBoundingClientRect();
							return box.top >= 0 && box.bottom <= innerHeight;
						})
					)
			)
			.toBe(true);
	});

// The resolved catalog uses the anchor itself as the card surface. Exercise it
// with real touch input as well as the mouse and keyboard journeys above.
test.describe('compact catalog touch', () => {
	test.use({ hasTouch: true, isMobile: true });
	for (const language of ['en', 'he'])
		test(`${language} native course taps and keyboard activation survive returns`, async ({
			page
		}) => {
			await page.route('**/*', (route) =>
				new URL(route.request().url()).origin === origin
					? route.continue()
					: route.abort()
			);
			await page.addInitScript(
				({ guest, language }) => {
					localStorage.setItem('lang', language);
					localStorage.setItem('version', '4');
					localStorage.setItem('userData', JSON.stringify(guest));
				},
				{ guest, language }
			);
			await page.goto(origin + '/app/catalog');
			const card = page.locator('.catalog-course-row a').first();
			await expect(card).toBeVisible();
			const href = await card.getAttribute('href');
			for (let repeat = 0; repeat < 3; repeat++) {
				await card.tap();
				await expect(page).toHaveURL(origin + href);
				await page.goBack();
				await expect(page).toHaveURL(origin + '/app/catalog');
				await expect(card).toBeInViewport();
			}
			await card.focus();
			await expect(card).toBeFocused();
			await page.keyboard.press('Enter');
			await expect(page).toHaveURL(origin + href);
		});
});
