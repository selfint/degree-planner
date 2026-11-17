import { expect, test } from '@playwright/test';

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
		// Even skipped offscreen groups retain real links and native focus/scroll.
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
