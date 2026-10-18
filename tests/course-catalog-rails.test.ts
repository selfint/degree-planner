import { readFileSync, writeFileSync } from 'node:fs';
import {
	expect,
	test,
	type Locator,
	type Page,
	type TestInfo
} from '@playwright/test';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;
type PublicCourse = {
	code: string;
	name: string;
	points?: number;
	connections: {
		dependencies: string[][];
		adjacent: string[];
		exclusive: string[];
	};
};
// These are expectations from the checked-in SAP snapshot, never route responses.
// The same tests exercise a local build and the deployed PLAYWRIGHT_BASE_URL.
const courses: Record<string, PublicCourse> = JSON.parse(
	readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
);
const courseCode = '01040033';
const dependantCodes = Object.values(courses)
	.filter((course) =>
		course.connections.dependencies.some((group) => group.includes(courseCode))
	)
	.map((course) => course.code)
	.sort();
const unequalDependenciesCode = '00480080';
const guest = {
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
};
const railSelector =
	'.course-relations .course-dependencies, .course-relations .course-row, .catalog-page .course-row';

type Language = 'en' | 'he';

async function prepareGuest(page: Page, language: Language) {
	// Use the real guest bootstrap, storage, authentication and public-data code.
	// Do not replace public data, browser APIs, service workers or account state.
	await page.addInitScript(
		({ language, guest }) => {
			localStorage.setItem('lang', language);
			localStorage.setItem('theme', 'light');
			localStorage.setItem('version', '4');
			localStorage.setItem('userData', JSON.stringify(guest));
		},
		{ language, guest }
	);
	await page.route('**/*', (route) =>
		new URL(route.request().url()).origin === origin
			? route.continue()
			: route.abort()
	);
}

async function settle(page: Page) {
	await expect(page.locator('main')).toBeVisible();
	await expect(
		page.locator('.course-loading, .catalog-loading, .loading-course')
	).toHaveCount(0);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	});
}

async function expectInlineCatalogMetrics(
	root: Locator,
	language: 'en' | 'he'
) {
	await root.evaluate(async () => {
		await document.fonts.ready;
	});
	const rows = await root.locator('.catalog-metric').evaluateAll((metrics) => {
		const box = (element: Element) => {
			const { left, right, top, bottom } = element.getBoundingClientRect();
			return { left, right, top, bottom };
		};
		return metrics.map((metric) => {
			const label = metric.querySelector('.catalog-metric-label')!;
			const values = metric.querySelector('.catalog-values')!;
			const text = [label, ...values.querySelectorAll('dt, dd')].map(
				(element) => {
					const style = getComputedStyle(element);
					const bounds = box(element);
					const range = document.createRange();
					range.selectNodeContents(element);
					const rects = [...range.getClientRects()].filter(
						(rect) => rect.width > 0
					);
					// A zero-size inline probe exposes the actual text baseline without
					// guessing from different 12px/13px glyph or line-box heights.
					const probe = document.createElement('span');
					probe.style.cssText =
						'display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline';
					element.append(probe);
					const baseline = probe.getBoundingClientRect().top;
					probe.remove();
					return {
						...bounds,
						text: element.textContent!.trim(),
						tag: element.tagName,
						baseline,
						fontSize: style.fontSize,
						whiteSpace: style.whiteSpace,
						overflowX: style.overflowX,
						visibility: style.visibility,
						lineClamp: style.webkitLineClamp,
						lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
						textFits: rects.every(
							(rect) =>
								rect.left >= bounds.left - 0.5 &&
								rect.right <= bounds.right + 0.5
						),
						overflow: element.scrollWidth - element.clientWidth
					};
				}
			);
			return {
				...box(metric),
				category: !metric.closest('.catalog-summary'),
				direction: getComputedStyle(metric).direction,
				values: box(values),
				valuesOverflow: values.scrollWidth - values.clientWidth,
				groups: [...values.children].map(box),
				text,
				viewport: innerWidth
			};
		});
	});
	expect(rows.length).toBeGreaterThan(2);
	const labels = language === 'he' ? ['קורסים', 'נקודות'] : ['Count', 'Points'];
	const terms =
		language === 'he'
			? ['בוצע', 'מתוכנן', 'סה״כ']
			: ['done', 'planned', 'total'];
	for (const [index, row] of rows.entries()) {
		const label = row.text[0];
		expect(label.text).toBe(labels[index % 2]);
		expect(row.direction).toBe(language === 'he' ? 'rtl' : 'ltr');
		expect(row.groups).toHaveLength(row.category ? 3 : 2);
		expect(
			row.text.filter((item) => item.tag === 'DT').map((item) => item.text)
		).toEqual(terms.slice(0, row.category ? 3 : 2));
		expect(
			row.valuesOverflow,
			`${label.text}: values stay in their track`
		).toBeLessThanOrEqual(1);
		expect(row.left).toBeGreaterThanOrEqual(0);
		expect(row.right).toBeLessThanOrEqual(row.viewport);
		expect(row.values.left).toBeGreaterThanOrEqual(row.left - 0.5);
		expect(row.values.right).toBeLessThanOrEqual(row.right + 0.5);
		const ordered = [label, ...row.groups];
		for (let i = 1; i < ordered.length; i++) {
			expect(
				row.direction === 'rtl'
					? ordered[i - 1].left - ordered[i].right
					: ordered[i].left - ordered[i - 1].right,
				`${label.text}: separate label and value groups on one row`
			).toBeGreaterThanOrEqual(0);
		}
		for (const group of row.groups) {
			expect(group.left).toBeGreaterThanOrEqual(row.values.left - 0.5);
			expect(group.right).toBeLessThanOrEqual(row.values.right + 0.5);
		}
		for (const item of row.text) {
			const description = `${label.text}: ${item.text}`;
			expect(item.text, description).not.toBe('');
			expect(item.fontSize, description).toBe(
				item.tag === 'DT' ? '12px' : '13px'
			);
			expect(item.whiteSpace, description).toBe('nowrap');
			expect(item.overflowX, description).toBe('visible');
			expect(item.visibility, description).toBe('visible');
			expect(item.lineClamp, description).toBe('none');
			expect(item.lines, description).toBe(1);
			expect(item.textFits, description).toBe(true);
			expect(item.overflow, description).toBeLessThanOrEqual(1);
			expect(
				Math.abs(item.baseline - label.baseline),
				`${description}: shared baseline`
			).toBeLessThanOrEqual(0.5);
			expect(item.left, description).toBeGreaterThanOrEqual(row.left - 0.5);
			expect(item.right, description).toBeLessThanOrEqual(row.right + 0.5);
		}
	}
}

async function measurePage(page: Page) {
	return page.evaluate((selector) => {
		const box = (element: Element) => {
			const { left, right, top, bottom, width, height } =
				element.getBoundingClientRect();
			return { left, right, top, bottom, width, height };
		};
		const rails = [...document.querySelectorAll<HTMLElement>(selector)].map(
			(rail) => {
				const bounds = box(rail);
				const heading = rail
					.closest('.course-relation-group, .catalog-section')!
					.querySelector('h2')!;
				const style = getComputedStyle(rail);
				return {
					...bounds,
					kind: rail.classList.contains('course-dependencies')
						? 'dependencies'
						: 'row',
					heading: { text: heading.textContent?.trim(), ...box(heading) },
					direction: style.direction,
					overflowX: style.overflowX,
					scrollLeft: rail.scrollLeft,
					maxScroll: rail.scrollWidth - rail.clientWidth,
					dependencyGroups: [
						...rail.querySelectorAll('.course-dependency-group')
					].map((group) => ({
						...box(group),
						codes: [...group.querySelectorAll('a')].map(
							(link) => link.getAttribute('href')!.split('/').at(-1)!
						)
					})),
					cards: [...rail.querySelectorAll('.course-card')].map((card) => {
						const bounds = box(card);
						const group = card.closest('.course-dependency-group');
						const link = card.closest('a')!;
						const rowIndex = group ? [...group.children].indexOf(link) : 0;
						const copy = card.querySelector('.course-copy')!;
						const copyBounds = box(copy);
						const name = copy.querySelector('.course-name')!;
						const nameBounds = box(name);
						const nameStyle = getComputedStyle(name);
						const codeBounds = box(copy.querySelector('.course-code')!);
						const copyStyle = getComputedStyle(copy);
						const railBounds = box(rail);
						return {
							...bounds,
							rowIndex,
							// Only the outer card stretches; its content remains intrinsic.
							naturalHeight: box(card.querySelector('.course-width')!).height,
							linkBounds: box(link),
							code: card.closest('a')!.getAttribute('href')!.split('/').at(-1)!,
							name: name.textContent?.trim(),
							title: name.getAttribute('title'),
							nameFits:
								nameBounds.left >= copyBounds.left - 1 &&
								nameBounds.right <= copyBounds.right + 1 &&
								nameBounds.height <= 3 * parseFloat(nameStyle.lineHeight) + 1,
							codeFits:
								codeBounds.left >= copyBounds.left - 1 &&
								codeBounds.right <= copyBounds.right + 1 &&
								codeBounds.top >= nameBounds.bottom - 1 &&
								codeBounds.bottom <= bounds.bottom + 1,
							copyHeight: copyBounds.height,
							codeStart: codeBounds.top - copyBounds.top,
							copyOverflow: copyStyle.overflow,
							nameOverflow: nameStyle.overflow,
							lineClamp: nameStyle.webkitLineClamp,
							nameLineHeight: parseFloat(nameStyle.lineHeight),
							nameFontSize: parseFloat(nameStyle.fontSize),
							visibleRatio:
								Math.max(
									0,
									Math.min(railBounds.right, bounds.right) -
										Math.max(railBounds.left, bounds.left)
								) / bounds.width
						};
					})
				};
			}
		);
		const header = document.querySelector('header.title-bar')!;
		return {
			url: location.href,
			viewport: { width: innerWidth, height: innerHeight },
			scrollX,
			scrollY,
			rootSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
			documentOverflow: document.documentElement.scrollWidth - innerWidth,
			header: {
				...box(header),
				direction: header.getAttribute('dir'),
				items: ['.brand', '.header-search', 'nav'].map((selector) =>
					box(header.querySelector(selector)!)
				)
			},
			footer: box(document.querySelector('footer')!),
			dependants: [
				...document.querySelectorAll('.course-dependants .course-card')
			].map((card) => ({
				...box(card),
				code: card.querySelector('.course-code')!.textContent!.trim(),
				naturalHeight: box(card.querySelector('.course-width')!).height,
				linkHeight: box(card.closest('a')!).height
			})),
			rails
		};
	}, railSelector);
}

type Geometry = Awaited<ReturnType<typeof measurePage>>;
type Rail = Geometry['rails'][number];

function expectLayout(geometry: Geometry, language: Language) {
	const { width } = geometry.viewport;
	const inset = geometry.rootSize * 0.75;
	const cardWidth = (width - geometry.rootSize * 2.5) / 3.25;
	expect(
		geometry.documentOverflow,
		'no horizontal document overflow'
	).toBeLessThanOrEqual(1);
	expect(
		Math.abs(geometry.scrollX),
		'document remains at its horizontal origin'
	).toBeLessThanOrEqual(1);
	expect(geometry.header.height, 'original single-row titlebar').toBe(48);
	expect(geometry.header.direction).toBe('ltr');
	for (const item of geometry.header.items) {
		expect(item.left).toBeGreaterThanOrEqual(0);
		expect(item.right).toBeLessThanOrEqual(width);
		expect(
			Math.abs(item.top + item.height / 2 - (geometry.header.top + 24))
		).toBeLessThanOrEqual(1);
	}
	expect(geometry.header.items[0].right).toBeLessThanOrEqual(
		geometry.header.items[1].left
	);
	expect(geometry.header.items[1].right).toBeLessThanOrEqual(
		geometry.header.items[2].left
	);
	expect(geometry.footer.left).toBeGreaterThanOrEqual(0);
	expect(geometry.footer.right).toBeLessThanOrEqual(width);
	for (const card of geometry.dependants) {
		const row = geometry.dependants.filter(
			(peer) => Math.abs(peer.top - card.top) < 1
		);
		const naturalHeight = Math.max(...row.map((peer) => peer.naturalHeight));
		expect(
			Math.abs(card.height - naturalHeight),
			`dependant ${card.code}: tallest intrinsic height within its wrapped row`
		).toBeLessThanOrEqual(1);
		expect(
			Math.abs(card.linkHeight - card.height),
			'full-height dependant link'
		).toBeLessThanOrEqual(1);
	}
	for (const rail of geometry.rails) {
		const label = rail.heading.text;
		expect(
			Math.abs(rail.left),
			`${label}: left viewport edge`
		).toBeLessThanOrEqual(1);
		expect(
			Math.abs(rail.right - width),
			`${label}: right viewport edge`
		).toBeLessThanOrEqual(1);
		expect(rail.direction, label).toBe(language === 'he' ? 'rtl' : 'ltr');
		expect(rail.overflowX, label).toBe('auto');
		const headingStart =
			language === 'he' ? width - rail.heading.right : rail.heading.left;
		expect(
			Math.abs(headingStart - inset),
			`${label}: unchanged heading inset`
		).toBeLessThanOrEqual(1);
		expectSynchronizedHeights(rail);
		for (const card of rail.cards) {
			expect(
				courses[card.code]?.name,
				`${label}: public named course ${card.code}`
			).toBeTruthy();
			expect(card.name, `${label}: complete name ${card.code}`).toBe(
				courses[card.code].name
			);
			expect(card.title).toBe(courses[card.code].name);
			expect(
				card.nameFits,
				`${label}: name stays within three lines ${card.code}`
			).toBe(true);
			expect(card.copyOverflow).toBe('visible');
			expect(card.nameOverflow).toBe('hidden');
			expect(card.lineClamp).toBe('3');
			expect(card.codeFits, `${label}: visible code ${card.code}`).toBe(true);
			expect(card.nameFontSize).toBeCloseTo(geometry.rootSize * 0.75);
			expect(card.nameLineHeight).toBe(card.nameFontSize);
			expect(card.copyHeight).toBeCloseTo(geometry.rootSize * 4.5);
			expect(card.codeStart).toBeCloseTo(geometry.rootSize * 3.75);
			expect(
				Math.abs(card.width - cardWidth),
				`${label}: accepted card width`
			).toBeLessThanOrEqual(1);
		}
	}
}

function expectSynchronizedHeights(rail: Rail) {
	for (const rowIndex of new Set(rail.cards.map((card) => card.rowIndex))) {
		const row = rail.cards.filter((card) => card.rowIndex === rowIndex);
		const naturalHeight = Math.max(...row.map((card) => card.naturalHeight));
		const label = `${rail.heading.text}: horizontal row ${rowIndex + 1}`;
		for (const card of row) {
			expect(
				Math.abs(card.height - naturalHeight),
				`${label}: ${card.code} stretches to the tallest natural-height card`
			).toBeLessThanOrEqual(1);
			expect(
				Math.abs(card.top - row[0].top),
				`${label}: aligned card tops`
			).toBeLessThanOrEqual(1);
			expect(
				Math.abs(card.bottom - row[0].bottom),
				`${label}: aligned card bottoms`
			).toBeLessThanOrEqual(1);
			expect(
				Math.abs(card.linkBounds.height - card.height),
				`${label}: full-height clickable card`
			).toBeLessThanOrEqual(1);
		}
	}
}

function expectInitial(rail: Rail, geometry: Geometry, language: Language) {
	const label = rail.heading.text;
	expect(rail.cards.length, `${label}: populated rail`).toBeGreaterThan(0);
	expect(
		Math.abs(rail.scrollLeft),
		`${label}: native initial reading edge`
	).toBeLessThanOrEqual(1);
	const first = rail.cards[0];
	const start =
		language === 'he' ? rail.right - first.right : first.left - rail.left;
	const headingStart =
		language === 'he'
			? rail.right - rail.heading.right
			: rail.heading.left - rail.left;
	expect(
		Math.abs(start - geometry.rootSize * 0.75),
		`${label}: internal start buffer`
	).toBeLessThanOrEqual(1);
	expect(
		Math.abs(start - headingStart),
		`${label}: first card aligns with heading`
	).toBeLessThanOrEqual(1);
	// AND/OR prerequisites contain stacked groups and separators, not simple columns.
	if (rail.kind === 'row' && rail.cards.length >= 4) {
		for (const card of rail.cards.slice(0, 3))
			expect(
				card.visibleRatio,
				`${label}: three complete cards`
			).toBeGreaterThanOrEqual(0.99);
		expect(
			rail.cards[3].visibleRatio,
			`${label}: visible fourth-card peek`
		).toBeGreaterThanOrEqual(0.1);
		expect(
			rail.cards[3].visibleRatio,
			`${label}: partial fourth card`
		).toBeLessThanOrEqual(0.85);
		if (rail.cards[4]) expect(rail.cards[4].visibleRatio).toBe(0);
	}
}

async function capture(page: Page, info: TestInfo, name: string) {
	await settle(page);
	const geometry = await measurePage(page);
	// Never use fullPage: it can change RTL scroll positions while capturing.
	const screenshotPath = info.outputPath(`${name}.png`);
	await page.screenshot({
		path: screenshotPath,
		fullPage: false,
		animations: 'disabled'
	});
	await info.attach(name, { path: screenshotPath, contentType: 'image/png' });
	const geometryPath = info.outputPath(`${name}-geometry.json`);
	writeFileSync(geometryPath, JSON.stringify(geometry, null, 2));
	await info.attach(`${name}-geometry`, {
		path: geometryPath,
		contentType: 'application/json'
	});
	return geometry;
}

async function scrollRail(
	page: Page,
	rail: Locator,
	index: number,
	language: Language,
	info: TestInfo,
	label: string
) {
	await rail.scrollIntoViewIfNeeded();
	const before = await capture(page, info, `${label}-before-scroll`);
	expectInitial(before.rails[index], before, language);
	const maxScroll = before.rails[index].maxScroll;
	expect(maxScroll, `${label}: actually scrollable`).toBeGreaterThan(20);
	const sign = language === 'he' ? -1 : 1;
	// This is a scrollport geometry measurement, not a touch-gesture claim.
	// Playwright's mobile WebKit explicitly does not implement mouse.wheel.
	await rail.evaluate(
		(element, left) => element.scrollTo({ left }),
		(sign * maxScroll) / 2
	);
	await expect
		.poll(() => rail.evaluate((element) => Math.abs(element.scrollLeft)))
		.toBeGreaterThan(maxScroll * 0.35);
	const middle = await capture(page, info, `${label}-middle`);
	expectLayout(middle, language);
	expect(Math.abs(middle.rails[index].scrollLeft)).toBeLessThan(
		maxScroll * 0.65
	);
	expect(middle.rails[index].cards[0].visibleRatio).toBeLessThan(0.99);
	await rail.evaluate(
		(element, left) => element.scrollTo({ left }),
		sign * maxScroll
	);
	await expect
		.poll(() =>
			rail.evaluate((element) =>
				Math.abs(
					Math.abs(element.scrollLeft) -
						(element.scrollWidth - element.clientWidth)
				)
			)
		)
		.toBeLessThanOrEqual(1);
	const end = await capture(page, info, `${label}-end`);
	expectLayout(end, language);
	expect(
		end.rails[index].cards.at(-1)!.visibleRatio,
		`${label}: last card reachable`
	).toBeGreaterThanOrEqual(0.99);
	return end.rails[index].cards.at(-1)!.code;
}

for (const viewport of [
	{ width: 320, height: 568 },
	{ width: 390, height: 664 }
]) {
	for (const language of ['en', 'he'] as const) {
		test.describe(`${viewport.width}px ${language} course and catalog rails`, () => {
			test.use({ viewport, isMobile: true, hasTouch: true });
			test.setTimeout(120_000);

			test('real relation rails reach both viewport edges and reset after related-course navigation', async ({
				page
			}, info) => {
				await prepareGuest(page, language);
				await page.goto(`${origin}/app/course/${courseCode}`);
				await expect(page.locator('h1.course-name')).toHaveText(
					courses[courseCode].name
				);
				await expect(page.locator('h1.course-name')).toHaveCSS(
					'-webkit-line-clamp',
					'none'
				);
				await expect(page.getByTestId('course-plan-actions')).toBeVisible();
				await expect(page.locator(railSelector)).toHaveCount(2);
				await expect(
					page.locator('.course-dependants .course-card')
				).toHaveCount(dependantCodes.length);
				const initial = await capture(page, info, 'course-initial');
				expectLayout(initial, language);
				for (const rail of initial.rails)
					expectInitial(rail, initial, language);
				expect(initial.dependants.map((card) => card.code).sort()).toEqual(
					dependantCodes
				);
				expect(initial.rails[0].cards.map((card) => card.code)).toEqual(
					courses[courseCode].connections.dependencies.flat()
				);
				expect(initial.rails[1].cards.map((card) => card.code).sort()).toEqual(
					[...courses[courseCode].connections.exclusive].sort()
				);
				// The real SAP snapshot has no adjacent records. Storybook covers that
				// branch with fictional data; this full-page suite never substitutes it.
				await scrollRail(
					page,
					page.locator('.course-dependencies'),
					0,
					language,
					info,
					'dependencies'
				);
				const exclusive = page.locator('.course-relations .course-row');
				const lastCode = await scrollRail(
					page,
					exclusive,
					1,
					language,
					info,
					'exclusive'
				);
				const timeOrigin = await page.evaluate(() => performance.timeOrigin);
				await exclusive.locator('a').last().tap();
				await expect(page).toHaveURL(`${origin}/app/course/${lastCode}`);
				await expect(page.locator('h1.course-name')).toHaveText(
					courses[lastCode].name
				);
				await expect(page.locator(railSelector)).toHaveCount(1);
				const navigated = await capture(page, info, 'related-course-initial');
				expectLayout(navigated, language);
				expectInitial(navigated.rails[0], navigated, language);
				expect(await page.evaluate(() => performance.timeOrigin)).toBe(
					timeOrigin
				);
				await expect(
					page.locator('header.title-bar').getByTestId('pwa-status')
				).toHaveCount(0);
				await expect(
					page.locator('footer').getByTestId('pwa-footer-row')
				).toHaveCount(1);
			});

			test('unequal dependency alternatives share row heights without stretching singletons over AND stacks', async ({
				page
			}, info) => {
				await prepareGuest(page, language);
				await page.goto(`${origin}/app/course/${unequalDependenciesCode}`);
				await expect(page.locator('h1.course-name')).toHaveText(
					courses[unequalDependenciesCode].name
				);
				const initial = await capture(
					page,
					info,
					'unequal-dependencies-initial'
				);
				expectLayout(initial, language);
				const railIndex = initial.rails.findIndex(
					(rail) => rail.kind === 'dependencies'
				);
				expect(railIndex).toBeGreaterThanOrEqual(0);
				const rail = initial.rails[railIndex];
				expectInitial(rail, initial, language);
				expect(rail.dependencyGroups.map((group) => group.codes)).toEqual(
					courses[unequalDependenciesCode].connections.dependencies
				);
				const singleton = rail.dependencyGroups.find(
					(group) => group.codes.length === 1
				)!;
				const stacked = rail.dependencyGroups.find(
					(group) => group.codes.length > 1
				)!;
				expect(singleton).toBeTruthy();
				expect(stacked).toBeTruthy();
				const singletonCard = rail.cards.find(
					(card) => card.code === singleton.codes[0]
				)!;
				expect(
					singletonCard.bottom,
					'singleton occupies only its first shared row'
				).toBeLessThan(stacked.bottom - 8);
				await scrollRail(
					page,
					page.locator('.course-dependencies'),
					railIndex,
					language,
					info,
					'unequal-dependencies'
				);
			});

			test('real catalog and guest wishlist keep the internal start buffer and native end access', async ({
				page
			}, info) => {
				await prepareGuest(page, language);
				await page.goto(`${origin}/app/catalog`);
				await expect(
					page
						.locator('.catalog-page .course-row')
						.first()
						.locator('.course-card')
				).toHaveCount(guest.wishlist.length);
				await expect(page.locator('.catalog-path').first()).toBeVisible();
				await expect(page.getByRole('meter')).toHaveCount(2);
				await expect(
					page.locator('.catalog-summary').getByRole('meter')
				).toHaveCount(2);
				await expect(
					page.locator('.catalog-section').getByRole('meter')
				).toHaveCount(0);
				await settle(page);
				await expectInlineCatalogMetrics(
					page.locator('.catalog-page'),
					language
				);
				await expect(
					page.locator('.catalog-summary .catalog-values dd')
				).toHaveText(['0', '0', '0', '0']);
				const panels = page.locator('.catalog-section .catalog-progress-panel');
				const categoryPointTotals: number[] = [];
				expect(await panels.count()).toBeGreaterThan(0);
				for (const panel of await panels.all()) {
					await expect(panel.locator('.catalog-metric')).toHaveCount(2);
					const codes = await panel.evaluate((panel) =>
						[
							...panel
								.closest('.catalog-section')!
								.querySelectorAll('.course-code')
						].map((code) => code.textContent!.trim())
					);
					const totals = [
						codes.length,
						codes.reduce((sum, code) => sum + (courses[code].points ?? 0), 0)
					];
					categoryPointTotals.push(totals[1]);
					for (const [index, metric] of (
						await panel.locator('.catalog-metric').all()
					).entries()) {
						await expect(metric.locator('dd')).toHaveText([
							'0',
							'0',
							String(totals[index])
						]);
					}
				}
				// The selected path can expose multi-digit and fractional totals in
				// separate categories; both still exercise the same narrow row layout.
				const largestTotal = Math.max(...categoryPointTotals);
				const largestFractionalTotal = Math.max(
					...categoryPointTotals.filter((total) => !Number.isInteger(total))
				);
				expect(largestTotal).toBeGreaterThanOrEqual(10);
				expect(largestFractionalTotal).toBeGreaterThan(0);
				const initial = await capture(page, info, 'catalog-initial');
				expect(initial.rails.length).toBeGreaterThan(1);
				expectLayout(initial, language);
				for (const rail of initial.rails)
					expectInitial(rail, initial, language);
				expect(initial.rails[0].cards.map((card) => card.code).sort()).toEqual(
					[...guest.wishlist].sort()
				);
				for (const [name, total] of [
					['catalog-multi-digit-metrics', largestTotal],
					['catalog-decimal-metrics', largestFractionalTotal]
				] as const) {
					await panels
						.nth(categoryPointTotals.indexOf(total))
						.scrollIntoViewIfNeeded();
					await capture(page, info, name);
				}
				const rows = page.locator('.catalog-page .course-row');
				await scrollRail(
					page,
					rows.first(),
					0,
					language,
					info,
					'catalog-wishlist'
				);
				const degreeIndex = initial.rails.findIndex(
					(rail, index) => index > 0 && rail.cards.length >= 4
				);
				expect(
					degreeIndex,
					'real degree row with enough cards for 3+peek'
				).toBeGreaterThan(0);
				await scrollRail(
					page,
					rows.nth(degreeIndex),
					degreeIndex,
					language,
					info,
					'catalog-degree'
				);
				const saved = await page.evaluate(() =>
					JSON.parse(localStorage.getItem('userData')!)
				);
				expect(saved.wishlist).toEqual(guest.wishlist);
				expect(saved.semesters).toEqual(guest.semesters);
				await expect(page).toHaveURL(`${origin}/app/catalog`);
			});
		});
	}
}
