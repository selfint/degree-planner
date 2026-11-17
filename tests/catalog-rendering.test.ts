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
		for (const row of orders)
			expect(row).toEqual(
				[...row].sort(
					(a, b) => b.median - a.median || a.code.localeCompare(b.code)
				)
			);
	});
