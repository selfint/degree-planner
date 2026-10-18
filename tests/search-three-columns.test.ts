import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { expectSearchFiltersVisible } from './helpers/searchFilters';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;
// Exercise the actual full-app data path, including individual course navigation.
// These expectations read the canonical dataset; no network fixtures replace it.
const courses = Object.values(
	JSON.parse(
		readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
	)
) as {
	code: string;
	name: string;
	about?: string;
	faculty?: string;
	points?: number;
	median?: number;
	current?: boolean;
}[];
const faculty = courses.find((course) => course.code === '01040184')!.faculty!;
const maxPoints =
	Math.ceil(Math.max(...courses.map((course) => course.points ?? 0)) * 2) / 2;

function expectedCourses(params: URLSearchParams) {
	const query = params.get('q') ?? '';
	const min = Number(params.get('pointsMin') ?? 0);
	const max = Number(params.get('pointsMax') ?? maxPoints);
	const median = Number(params.get('medianMin') ?? 0);
	return courses
		.filter(
			(course) =>
				(course.code.includes(query) ||
					course.name.includes(query) ||
					course.about?.includes(query)) &&
				(!params.has('available') || course.current) &&
				(!params.has('faculty') || course.faculty === params.get('faculty')) &&
				((min === 0 && max === maxPoints) ||
					(course.points !== undefined &&
						course.points >= min &&
						course.points <= max)) &&
				(median === 0 ||
					(course.median !== undefined && course.median >= median))
		)
		.sort((a, b) => (b.median ?? 0) - (a.median ?? 0));
}

async function expectResults(page: Page, params: URLSearchParams) {
	await expect
		.poll(() => Object.fromEntries(new URL(page.url()).searchParams))
		.toEqual(Object.fromEntries(params));
	await expectSearchFiltersVisible(page);
	await expect(page.locator('#search-faculty')).toHaveValue(
		params.get('faculty') ?? ''
	);
	await expect(page.locator('fieldset input[type="checkbox"]')).toBeChecked({
		checked: params.has('available')
	});
	for (const [key, selector, fallback] of [
		['pointsMin', '#search-points-min-input', 0],
		['pointsMax', '#search-points-max-input', maxPoints]
	] as const)
		await expect(page.locator(selector)).toHaveValue(
			Number(params.get(key) ?? fallback).toFixed(1)
		);
	await expect(
		page.locator('fieldset input[type="number"]').last()
	).toHaveValue(Number(params.get('medianMin') ?? 0).toFixed(1));
	const expected = expectedCourses(params);
	await expect
		.poll(() =>
			page
				.locator('.search-results > li')
				.evaluateAll((items) => items.map((item) => item.id))
		)
		.toEqual(expected.map((course) => course.code));
	// CourseElement resolves its own promise after the list has already rendered.
	await expect(page.locator('.search-results .course-code')).toHaveCount(
		expected.length
	);
	await expect(page.locator('main p[role="status"]')).toHaveText(
		new RegExp(`^${expected.length}\\s`)
	);
	return expected;
}

async function expectThreeColumns(page: Page) {
	await page.evaluate(() => document.fonts.ready);
	const layout = await page.locator('.search-results').evaluate((list) => {
		const box = (element: Element) => {
			const { left, right, top, bottom, width, height } =
				element.getBoundingClientRect();
			return { left, right, top, bottom, width, height };
		};
		return {
			labels: [
				...document.querySelectorAll(
					'.filter-available, .filter-field > label, label.filter-field > span, .filter-range > label:first-child, .filter-clear'
				)
			].map((label) => {
				const range = document.createRange();
				range.selectNodeContents(label);
				const text = range.getBoundingClientRect();
				return {
					text: label.textContent?.trim(),
					box: box(label),
					textBox: { left: text.left, right: text.right, height: text.height },
					lineHeight: parseFloat(getComputedStyle(label).lineHeight)
				};
			}),
			viewport: innerWidth,
			scrollWidth: document.documentElement.scrollWidth,
			scrollX,
			direction: getComputedStyle(list).direction,
			columns: getComputedStyle(list).gridTemplateColumns.split(' ').length,
			cards: [...list.querySelectorAll('.course-card')].map((card) => {
				const copy = card.querySelector('.course-copy')!;
				const name = card.querySelector('.course-name')!;
				const code = card.querySelector('.course-code')!;
				const nameStyle = getComputedStyle(name);
				const codeStyle = getComputedStyle(code);
				return {
					...box(card),
					squeezed: !!card.querySelector('.course-body-squeezed'),
					copy: box(copy),
					copyMin: getComputedStyle(copy).minBlockSize,
					name: box(name),
					nameFont: nameStyle.fontSize,
					nameLine: nameStyle.lineHeight,
					nameClamp: nameStyle.webkitLineClamp,
					nameOverflow: nameStyle.overflow,
					nameText: name.textContent,
					nameTitle: name.getAttribute('title'),
					code: box(code),
					codeText: code.textContent!.trim(),
					codeFont: codeStyle.fontSize,
					codeLine: codeStyle.lineHeight,
					codeWhiteSpace: codeStyle.whiteSpace
				};
			})
		};
	});
	expect(layout.scrollWidth, 'no horizontal page overflow').toBeLessThanOrEqual(
		layout.viewport
	);
	expect(Math.abs(layout.scrollX)).toBeLessThanOrEqual(1);
	expect(layout.labels, 'all six visible filter labels').toHaveLength(6);
	for (const label of layout.labels) {
		expect(label.textBox.height, `${label.text}: one line`).toBeLessThanOrEqual(
			label.lineHeight + 1
		);
		expect(label.textBox.left).toBeGreaterThanOrEqual(label.box.left - 1);
		expect(label.textBox.right).toBeLessThanOrEqual(label.box.right + 1);
	}
	expect(layout.columns, 'three equal mobile grid tracks').toBe(3);
	expect(layout.cards.length).toBeGreaterThanOrEqual(6);
	const first = layout.cards[0];
	const firstRow = layout.cards.filter(
		(card) => Math.abs(card.top - first.top) < 1
	);
	expect(
		firstRow,
		'exactly three complete cards on the first row'
	).toHaveLength(3);
	for (let index = 0; index < 3; index++) {
		expect(Math.abs(firstRow[index].width - first.width)).toBeLessThanOrEqual(
			1
		);
		expect(layout.cards[index + 3].left).toBeCloseTo(firstRow[index].left, 0);
		expect(layout.cards[index + 3].top).toBeGreaterThan(firstRow[index].bottom);
		if (index > 0) {
			if (layout.direction === 'rtl')
				expect(firstRow[index].right).toBeLessThan(firstRow[index - 1].left);
			else
				expect(firstRow[index].left).toBeGreaterThan(firstRow[index - 1].right);
		}
	}
	for (const card of layout.cards) {
		expect(card.left).toBeGreaterThanOrEqual(0);
		expect(card.right).toBeLessThanOrEqual(layout.viewport);
		expect(card.squeezed, card.codeText).toBe(false);
		expect(card.copyMin, 'normal five name lines plus separate code').toBe(
			'72px'
		);
		expect(card.copy.height).toBe(72);
		expect(card.nameFont).toBe('12px');
		expect(card.nameLine).toBe('12px');
		expect(card.nameClamp).toBe('3');
		expect(card.nameOverflow).toBe('hidden');
		expect(card.name.height).toBeGreaterThan(0);
		expect(card.name.height).toBeLessThanOrEqual(36);
		expect(card.nameTitle).toBe(card.nameText);
		expect(card.codeText).toMatch(/^\d{8}$/);
		expect(card.codeFont).toBe('12px');
		expect(card.codeLine).toBe('12px');
		expect(card.codeWhiteSpace).toBe('nowrap');
		expect(card.code.top).toBeGreaterThanOrEqual(card.name.bottom);
		expect(card.code.bottom).toBeLessThanOrEqual(card.bottom);
		expect(card.code.left).toBeGreaterThanOrEqual(card.left);
		expect(card.code.right).toBeLessThanOrEqual(card.right);
	}
	return layout;
}

for (const language of ['en', 'he']) {
	for (const width of [320, 390]) {
		test.describe(`three-column search ${language} ${width}px`, () => {
			test.use({
				viewport: { width, height: 844 },
				isMobile: true,
				hasTouch: true
			});
			test('keeps real cards in three columns through filter permutations and navigation', async ({
				page
			}, info) => {
				test.setTimeout(90_000);
				await page.addInitScript(
					(lang) => localStorage.setItem('lang', lang),
					language
				);
				await page.goto(`${origin}/app/search?q=1040`);
				const params = new URLSearchParams({ q: '1040' });
				await expectResults(page, params);
				const layout = await expectThreeColumns(page);
				const layoutPath = info.outputPath(
					'real-search-three-columns-layout.json'
				);
				writeFileSync(layoutPath, JSON.stringify(layout, null, 2));
				await info.attach('real-search-three-columns-layout', {
					path: layoutPath,
					contentType: 'application/json'
				});
				await page.screenshot({
					path: info.outputPath('search-three-columns.png')
				});
				await page
					.locator('.search-results > li')
					.first()
					.scrollIntoViewIfNeeded();
				await page.screenshot({
					path: info.outputPath('search-three-columns-results.png')
				});
				const changes = [
					['available', ''],
					['faculty', faculty],
					['pointsMin', '2'],
					['pointsMax', '5'],
					['medianMin', '80']
				];
				// The two widths exercise opposite commit orders on the same live controls.
				for (const [key, value] of width === 320
					? changes
					: changes.toReversed()) {
					if (key === 'available')
						await page.locator('fieldset input[type="checkbox"]').check();
					else if (key === 'faculty')
						await page.locator('#search-faculty').selectOption(value);
					else {
						const input =
							key === 'medianMin'
								? page.locator('fieldset input[type="number"]').last()
								: page.locator(
										`#search-points-${key === 'pointsMin' ? 'min' : 'max'}-input`
									);
						await input.fill(value);
						await input.press('Enter');
					}
					params.set(key, value);
					await expectResults(page, params);
					await expectThreeColumns(page);
				}
				await page.reload();
				const filtered = await expectResults(page, params);
				await expectThreeColumns(page);
				await page.locator('.search-result').first().tap();
				await expect(page).toHaveURL(
					`${origin}/app/course/${filtered[0].code}`
				);
				await expect(page.locator('h1.course-name')).toHaveText(
					filtered[0].name
				);
				await page.goBack();
				await expectResults(page, params);
				await expectThreeColumns(page);
				await page.locator('fieldset button').click();
				await expectResults(page, new URLSearchParams({ q: '1040' }));
				await expectThreeColumns(page);
				await page.goBack();
				await expectResults(page, params);
				await page.goForward();
				await expectResults(page, new URLSearchParams({ q: '1040' }));
				const search = page.locator('header input[type="text"]');
				await search.fill('no-such-course-three-columns');
				await search.press('Enter');
				await expectResults(
					page,
					new URLSearchParams({ q: 'no-such-course-three-columns' })
				);
				await expect(page.locator('.search-empty')).toBeVisible();
				await page.goBack();
				await expectResults(page, new URLSearchParams({ q: '1040' }));
				await expectThreeColumns(page);
			});
		});
	}
}

test.describe('desktop search density', () => {
	test.use({
		viewport: { width: 1180, height: 800 },
		isMobile: false,
		hasTouch: false
	});
	test('retains the shared fixed-width cards and wraps without page overflow', async ({
		page
	}) => {
		await page.addInitScript(() => localStorage.setItem('lang', 'en'));
		await page.goto(`${origin}/app/search?q=1040`);
		await expectResults(page, new URLSearchParams({ q: '1040' }));
		const layout = await page.locator('.search-results').evaluate((list) => {
			const cards = [...list.querySelectorAll('.course-card')].map((card) => {
				const { left, right, top, width } = card.getBoundingClientRect();
				return { left, right, top, width };
			});
			return {
				viewport: innerWidth,
				scrollWidth: document.documentElement.scrollWidth,
				cards,
				firstRow: cards.filter((card) => Math.abs(card.top - cards[0].top) < 1)
			};
		});
		expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
		expect(layout.firstRow.length).toBeGreaterThanOrEqual(4);
		for (const card of layout.cards) {
			expect(card.width).toBe(168);
			expect(card.left).toBeGreaterThanOrEqual(0);
			expect(card.right).toBeLessThanOrEqual(layout.viewport);
		}
		await expect(
			page.locator('.search-results .course-body-squeezed')
		).toHaveCount(0);
	});
});
