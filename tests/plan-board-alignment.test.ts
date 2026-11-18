import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
// The delivered density screenshot's public courses and fictional guest plan.
// Keep their full DOM names and fractional totals intact.
const catalogBody = readFileSync(
	new URL('../static/courseData.json', import.meta.url),
	'utf8'
);
const catalog: Record<string, { name: string; points?: number }> =
	JSON.parse(catalogBody);
const guest = {
	degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
	path: 'CG00006246',
	exemptions: [],
	currentSemester: 0,
	wishlist: ['02340124', '02340141', '02340128', '02340129'],
	semesters: [
		['02340114', '02340117', '02340118'],
		['02340123', '02340125', '02340218'],
		['02340221', '02340230', '02340247'],
		['02340290', '02340291', '02340292'],
		['02340303', '02340311', '02340313'],
		[]
	]
};
const allCodes = [...guest.wishlist, ...guest.semesters.flat()];
const expectedTotals = guest.semesters.map((semester) =>
	semester.reduce((total, code) => total + (catalog[code].points ?? 0), 0)
);

async function measureBoard(page: Page) {
	return page.evaluate(() => {
		const box = (element: Element) => {
			const { left, right, top, bottom, width, height } =
				element.getBoundingClientRect();
			return { left, right, top, bottom, width, height };
		};
		const semesters = [...document.querySelectorAll('[data-semester]')].map(
			(element) => ({
				index: Number(element.getAttribute('data-semester')),
				list: box(element),
				title: box(
					element
						.closest('.semester-column--board')!
						.querySelector('.semester-title')!
				),
				exams: box(
					element
						.closest('.semester-column--board')!
						.querySelector('.semester-exams-row')!
				),
				cards: [...element.querySelectorAll('.course-card')].map(box)
			})
		);
		const wishlist = [
			...document.querySelectorAll('[data-testid="plan-wishlist"] .course-card')
		].map((element) => ({
			code: element.closest('[data-code]')!.getAttribute('data-code'),
			naturalHeight: box(element.querySelector('.course-width')!).height,
			buttonHeight: box(element.closest('button')!).height,
			...box(element)
		}));
		const wishlistBottom = Math.max(...wishlist.map((card) => card.bottom));
		const visibleWishlistBottom = Math.max(
			...wishlist
				.filter((card) => card.left >= 0 && card.right <= innerWidth)
				.map((card) => card.bottom)
		);
		const headingTop = Math.min(
			...[...document.querySelectorAll('.semester-heading')].map(
				(element) => element.getBoundingClientRect().top
			)
		);
		const rails = [
			...document.querySelectorAll<HTMLElement>('[data-plan-scroll]')
		].map((rail) => {
			const bounds = box(rail);
			const selector = rail.querySelector('[data-semester]')
				? '[data-semester]'
				: '[data-code]';
			return {
				id: rail.getAttribute('data-testid'),
				scrollLeft: rail.scrollLeft,
				maxScroll: rail.scrollWidth - rail.clientWidth,
				ratios: [...rail.querySelectorAll(selector)].map((element) => {
					const card = box(element);
					return (
						Math.max(
							0,
							Math.min(bounds.right, card.right) -
								Math.max(bounds.left, card.left)
						) / card.width
					);
				})
			};
		});
		const plan = document.querySelector('.plan-page')!;
		const rail = document.querySelector('[data-testid="semester-scroller"]')!;
		// The flipped scroller puts its CSS bottom padding visually above the row.
		const visualBottomInset = Math.max(
			0,
			rail.getBoundingClientRect().bottom -
				rail.firstElementChild!.getBoundingClientRect().bottom
		);
		const bottomSpacing =
			parseFloat(getComputedStyle(plan).marginBottom) + visualBottomInset;
		const clampedCourseNames = [
			...document.querySelectorAll('.course-card .course-name')
		].filter((name) => {
			const copy = name.closest('.course-copy')!.getBoundingClientRect();
			const bounds = name.getBoundingClientRect();
			const code = name.nextElementSibling!.getBoundingClientRect();
			const style = getComputedStyle(name);
			return (
				!!name.textContent?.trim() &&
				name.getAttribute('title') === name.textContent.trim() &&
				style.webkitLineClamp === '3' &&
				style.overflow === 'hidden' &&
				bounds.height <= 3 * parseFloat(style.lineHeight) + 1 &&
				bounds.left >= copy.left - 1 &&
				bounds.right <= copy.right + 1 &&
				(code.top >= bounds.bottom - 1 ||
					(innerWidth >= 640 &&
						Math.abs(code.bottom - bounds.bottom) <= 1 &&
						(code.right <= bounds.left + 1 ||
							code.left >= bounds.right - 1))) &&
				code.bottom <= copy.bottom + 1 &&
				code.left >= copy.left - 1 &&
				code.right <= copy.right + 1
			);
		}).length;
		return {
			viewport: { width: innerWidth, height: innerHeight },
			scrollY,
			semesters,
			wishlist,
			headingTop,
			wishlistBottom,
			visibleWishlistBottom,
			gapAfterTallestWishlistCard: headingTop - wishlistBottom,
			apparentGapAfterVisibleWishlistCards: headingTop - visibleWishlistBottom,
			bottomSpacing,
			rails,
			clampedCourseNames,
			documentOverflow: document.documentElement.scrollWidth - innerWidth
		};
	});
}

type Board = Awaited<ReturnType<typeof measureBoard>>;

function expectAligned(
	board: Board,
	label: string,
	examSemester: number | null = 0
) {
	const wishlistHeight = Math.max(
		...board.wishlist.map((card) => card.naturalHeight)
	);
	for (const card of board.wishlist) {
		expect
			.soft(
				Math.abs(card.height - wishlistHeight),
				`${label}: wishlist cards share tallest natural height`
			)
			.toBeLessThanOrEqual(1);
		expect
			.soft(
				Math.abs(card.buttonHeight - card.height),
				`${label}: wishlist action covers the full card`
			)
			.toBeLessThanOrEqual(1);
	}

	const listTops = board.semesters.map((semester) => semester.list.top);
	const top = Math.min(...listTops);
	const titleBottom = board.semesters[0].title.bottom;
	for (const semester of board.semesters) {
		expect
			.soft(
				Math.abs(semester.title.bottom - titleBottom),
				`${label}: aligned titles`
			)
			.toBeLessThanOrEqual(1);
		expect
			.soft(
				Math.abs(semester.exams.top - titleBottom - 6),
				`${label}: body follows title`
			)
			.toBeLessThanOrEqual(1);
		expect
			.soft(
				Math.abs(semester.list.top - semester.exams.bottom),
				`${label}: courses follow only their own exams`
			)
			.toBeLessThanOrEqual(1);
		if (semester.cards.length)
			expect
				.soft(
					Math.abs(semester.cards[0].top - semester.list.top),
					`${label}: first card starts at list top`
				)
				.toBeLessThanOrEqual(1);
		if (semester.index === examSemester) {
			expect(semester.exams.height).toBeGreaterThan(0);
			expect(semester.list.top).toBeGreaterThan(top);
		} else {
			expect(semester.exams.height).toBe(0);
			expect
				.soft(
					Math.abs(semester.list.top - top),
					`${label}: no exam gap in other semesters`
				)
				.toBeLessThanOrEqual(1);
		}
	}
	const empty = board.semesters.at(-1)!;
	expect(empty.cards).toHaveLength(0);
	const bottoms = board.semesters.map((semester) => semester.list.bottom);
	for (const bottom of bottoms)
		expect
			.soft(
				Math.abs(bottom - empty.list.bottom),
				`${label}: full-height empty drop target`
			)
			.toBeLessThanOrEqual(1);
	const lastCardBottom = Math.max(
		...board.semesters.flatMap((semester) =>
			semester.cards.map((card) => card.bottom)
		)
	);
	const expectedBottom = Math.max(
		board.viewport.height - board.bottomSpacing,
		lastCardBottom,
		top + 128
	);
	expect
		.soft(
			Math.abs(empty.list.bottom - expectedBottom),
			`${label}: target reaches the real board bottom without excess blank space`
		)
		.toBeLessThanOrEqual(1);
	expect
		.soft(
			board.clampedCourseNames,
			`${label}: three-line course names with visible codes`
		)
		.toBe(allCodes.length);
	expect
		.soft(board.documentOverflow, `${label}: no document overflow`)
		.toBeLessThanOrEqual(1);
}

async function capture(page: Page, info: TestInfo, name: string) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	});
	const measurement = await measureBoard(page);
	const path = info.outputPath(`${name}.png`);
	// Viewport only: fullPage screenshots can alter RTL rail scroll positions.
	await page.screenshot({ path, fullPage: false, animations: 'disabled' });
	await info.attach(name, { path, contentType: 'image/png' });
	const geometryPath = info.outputPath(`${name}-geometry.json`);
	writeFileSync(geometryPath, JSON.stringify(measurement, null, 2));
	await info.attach(`${name}-geometry`, {
		path: geometryPath,
		contentType: 'application/json'
	});
	return measurement;
}

async function captureCatalogEdges(page: Page, info: TestInfo) {
	await expect(
		page.locator('.catalog-section .course-card').first()
	).toBeVisible();
	await expect(
		page.locator('.catalog-loading, .catalog-page .course-loading')
	).toHaveCount(0);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	});
	const geometry = await page
		.locator('.catalog-page .course-row')
		.evaluateAll((rows) => ({
			viewport: { width: innerWidth, height: innerHeight },
			documentOverflow: document.documentElement.scrollWidth - innerWidth,
			rows: rows.map((row) => {
				const bounds = row.getBoundingClientRect();
				return {
					left: bounds.left,
					right: bounds.right,
					top: bounds.top,
					scrollLeft: row.scrollLeft,
					direction: getComputedStyle(row).direction,
					cards: [...row.querySelectorAll('.course-card')].map((card) => {
						const rect = card.getBoundingClientRect();
						return {
							left: rect.left,
							right: rect.right,
							ratio:
								Math.max(
									0,
									Math.min(bounds.right, rect.right) -
										Math.max(bounds.left, rect.left)
								) / rect.width
						};
					})
				};
			})
		}));
	const path = info.outputPath('catalog-initial.png');
	await page.screenshot({ path, fullPage: false, animations: 'disabled' });
	await info.attach('catalog-initial', { path, contentType: 'image/png' });
	const geometryPath = info.outputPath('catalog-initial-geometry.json');
	writeFileSync(geometryPath, JSON.stringify(geometry, null, 2));
	await info.attach('catalog-initial-geometry', {
		path: geometryPath,
		contentType: 'application/json'
	});
	expect(geometry.rows.length).toBeGreaterThan(0);
	expect(geometry.rows.some((row) => row.cards.length >= 4)).toBe(true);
	expect.soft(geometry.documentOverflow).toBeLessThanOrEqual(1);
	for (const row of geometry.rows) {
		expect
			.soft(Math.abs(row.left), 'catalog row reaches left viewport edge')
			.toBeLessThanOrEqual(1);
		expect
			.soft(
				Math.abs(row.right - geometry.viewport.width),
				'catalog row reaches right viewport edge'
			)
			.toBeLessThanOrEqual(1);
		expect
			.soft(Math.abs(row.scrollLeft), 'catalog starts at native reading edge')
			.toBeLessThanOrEqual(1);
		if (row.cards.length >= 4) {
			for (const card of row.cards.slice(0, 3))
				expect.soft(card.ratio).toBeGreaterThanOrEqual(0.99);
			expect.soft(row.cards[3].ratio).toBeGreaterThanOrEqual(0.1);
			expect.soft(row.cards[3].ratio).toBeLessThanOrEqual(0.85);
		}
	}
}

for (const viewport of [
	{ width: 320, height: 568 },
	{ width: 390, height: 664 },
	{ width: 1440, height: 900 }
]) {
	for (const language of ['en', 'he'] as const) {
		test.describe(`${viewport.width}x${viewport.height} ${language} plan board`, () => {
			test.use({
				viewport,
				isMobile: viewport.width < 640,
				hasTouch: viewport.width < 640,
				serviceWorkers: 'allow'
			});
			test('keeps exams local and titles aligned after language and viewport changes', async ({
				page
			}, info) => {
				test.setTimeout(60_000);
				await page.addInitScript(
					({ language, guest }) => {
						localStorage.setItem('lang', language);
						localStorage.setItem('theme', 'light');
						localStorage.setItem('version', '4');
						if (!localStorage.getItem('userData'))
							localStorage.setItem('userData', JSON.stringify(guest));
					},
					{ language, guest }
				);
				await page.route('**/*', async (route) => {
					const url = new URL(route.request().url());
					if (url.origin !== new URL(origin).origin) return route.abort();
					if (/^\/courseData(?:Stripped)?\.json$/.test(url.pathname))
						return route.fulfill({
							body: catalogBody,
							contentType: 'application/json'
						});
					return route.continue();
				});
				await page.goto(`${origin}/app/plan`);
				await expect(page.locator('main')).toBeVisible();
				// Match the healthy full shell in the delivered reference screenshot,
				// rather than injecting an install error through blocked workers.
				await expect(page.getByTestId('pwa-status')).toHaveAttribute(
					'data-state',
					'ready',
					{ timeout: 45_000 }
				);
				await expect(page.locator('.console-shell')).toHaveAttribute(
					'dir',
					language === 'he' ? 'rtl' : 'ltr'
				);
				await expect(page.locator('[data-semester]')).toHaveCount(
					guest.semesters.length
				);
				await expect
					.poll(() =>
						page
							.locator('.semester-summary .semester-points')
							.evaluateAll((elements) =>
								elements.map((element) => parseFloat(element.textContent!))
							)
					)
					.toEqual(expectedTotals);
				for (const code of allCodes) {
					const name = page.locator(`[data-code="${code}"] .course-name`);
					await expect(name).toHaveText(catalog[code].name);
					await expect(name).toHaveAttribute('title', catalog[code].name);
				}
				const exams = page.locator('.semester-exams');
				await expect(exams).toHaveCount(1);
				await expect(exams.locator('.study-days')).toBeVisible();
				await expect(page.locator('details.semester-exams')).toHaveCount(0);
				const initial = await capture(page, info, 'board-initial');
				expectAligned(initial, 'initial resolved board');
				for (const rail of initial.rails) {
					if (viewport.width >= 640) continue;
					expect
						.soft(
							Math.abs(
								rail.scrollLeft - (language === 'he' ? rail.maxScroll : 0)
							),
							`${rail.id}: initial reading edge`
						)
						.toBeLessThanOrEqual(1);
					for (const ratio of rail.ratios.slice(0, 3))
						expect.soft(ratio).toBeGreaterThanOrEqual(0.99);
					expect.soft(rail.ratios[3]).toBeGreaterThanOrEqual(0.1);
					expect.soft(rail.ratios[3]).toBeLessThanOrEqual(0.85);
					if (rail.ratios[4] !== undefined) expect.soft(rail.ratios[4]).toBe(0);
				}
				// Squeezed planner cards retain intrinsic copy height within the
				// three-line name cap; the row still follows its tallest card.
				expect(initial.wishlistBottom).toBe(initial.visibleWishlistBottom);
				expect(initial.gapAfterTallestWishlistCard).toBeGreaterThanOrEqual(0);

				const otherLanguage = language === 'en' ? 'he' : 'en';
				await page.locator('footer .language-control select').selectOption({
					label: otherLanguage === 'he' ? 'עב' : 'en'
				});
				await expect(page.locator('.console-shell')).toHaveAttribute(
					'dir',
					otherLanguage === 'he' ? 'rtl' : 'ltr'
				);
				await page.evaluate(() => scrollTo(0, 0));
				await expect(exams.locator('.study-days')).toBeVisible();
				const translated = await capture(page, info, 'board-language-switched');
				expectAligned(translated, 'translated visible study days');
				await page.setViewportSize(
					viewport.width === 320
						? { width: 390, height: 664 }
						: { width: 320, height: 568 }
				);
				await page.evaluate(() => scrollTo(0, 0));
				await expect(exams.locator('.study-days')).toBeVisible();
				const resized = await capture(page, info, 'board-viewport-resized');
				expectAligned(resized, 'resized visible study days');
				await expect(page.locator('details.semester-exams')).toHaveCount(0);
				const saved = await page.evaluate(() =>
					JSON.parse(localStorage.getItem('userData')!)
				);
				expect(saved.semesters).toEqual(guest.semesters);
				expect(saved.wishlist).toEqual(guest.wishlist);
				await expect(page).toHaveURL(`${origin}/app/plan`);
				// Moving the current semester moves only its exam gap; an empty current
				// semester leaves every course list directly beneath its title.
				for (const currentSemester of [1, guest.semesters.length - 1]) {
					await page.evaluate((currentSemester) => {
						const saved = JSON.parse(localStorage.getItem('userData')!);
						saved.currentSemester = currentSemester;
						localStorage.setItem('userData', JSON.stringify(saved));
					}, currentSemester);
					await page.reload();
					await expect(
						page.locator('[data-semester] .course-card')
					).toHaveCount(guest.semesters.flat().length);
					const hasExams = currentSemester === 1;
					await expect(exams).toHaveCount(hasExams ? 1 : 0);
					const changed = await capture(
						page,
						info,
						`board-current-${currentSemester}`
					);
					expectAligned(
						changed,
						`current semester ${currentSemester}`,
						hasExams ? currentSemester : null
					);
				}
				// Restore the named case's viewport/language before its catalog evidence.
				await page.setViewportSize(viewport);
				await page
					.locator('footer .language-control select')
					.selectOption({ label: language === 'he' ? 'עב' : 'en' });
				await page.locator('header.title-bar a[href="/app/catalog"]').click();
				await expect(page).toHaveURL(`${origin}/app/catalog`);
				await expect(page.locator('.console-shell')).toHaveAttribute(
					'dir',
					language === 'he' ? 'rtl' : 'ltr'
				);
				if (viewport.width < 640) await captureCatalogEdges(page, info);
			});
		});
	}
}
