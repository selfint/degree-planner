import { expectSearchFiltersVisible } from './helpers/searchFilters';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const courses = Object.values(
	JSON.parse(
		readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
	)
) as {
	code: string;
	name?: string;
	about?: string;
	faculty?: string;
	points?: number;
	current?: boolean;
	median?: number;
}[];
const maxPoints =
	Math.ceil(Math.max(...courses.map((c) => c.points ?? 0)) * 2) / 2;
type State = {
	q: string;
	faculty: string;
	available: boolean;
	pointsMax: number;
};
const mechanical = 'הפקולטה להנדסת מכונות';
const physics = 'הפקולטה לפיזיקה';
const chemistry = 'הפקולטה לכימיה';

async function waitForSearchReady(page: Page) {
	// The document load event can precede hydration and async course-data rendering.
	// Broad Hebrew queries took 7–10s in WebKit traces. Keep the existing startup
	// budget while waiting for the always-visible native faculty control.
	await page.locator('#search-faculty').waitFor({
		state: 'visible',
		timeout: 30_000
	});
}

async function expectResults(page: Page, state: State) {
	const params: Record<string, string> = { q: state.q };
	if (state.faculty) params.faculty = state.faculty;
	if (state.available) params.available = '';
	if (state.pointsMax < maxPoints) params.pointsMax = String(state.pointsMax);
	await expect
		.poll(() => Object.fromEntries(new URL(page.url()).searchParams))
		.toEqual(params);
	await expect(page.locator('#search-faculty')).toHaveValue(state.faculty);
	await expect(page.locator('fieldset input[type="checkbox"]')).toBeChecked({
		checked: state.available
	});
	await expect(page.locator('#search-points-max-input')).toHaveValue(
		state.pointsMax.toFixed(1)
	);
	const expected = courses
		.filter(
			(c) =>
				(c.code.includes(state.q) ||
					c.name?.includes(state.q) ||
					c.about?.includes(state.q)) &&
				(!state.faculty || c.faculty === state.faculty) &&
				(!state.available || c.current) &&
				(state.pointsMax === maxPoints ||
					(c.points !== undefined && c.points <= state.pointsMax))
		)
		.sort((a, b) => (b.median ?? 0) - (a.median ?? 0));
	await expect
		.poll(() =>
			page
				.locator('main ul > li')
				.evaluateAll((items) => items.map((item) => item.id))
		)
		.toEqual(expected.map((c) => c.code));
	await expect
		.poll(async () =>
			Number(
				(await page.locator('main p[role="status"]').innerText()).match(
					/^\d+/
				)?.[0]
			)
		)
		.toBe(expected.length);
	// Filters stay visible after URL changes and Back/Forward, without extra clicks.
	await expectSearchFiltersVisible(page);
}

async function chooseNativeFaculty(page: Page, faculty: string) {
	const select = page.locator('#search-faculty');
	const index = await select.evaluate(
		(element: HTMLSelectElement, value) =>
			[...element.options].findIndex((option) => option.value === value),
		faculty
	);
	expect(index).toBeGreaterThanOrEqual(0);
	// Exercise the browser's actual picker/keyboard event sequence, not selectOption or synthetic change.
	await select.click();
	const current = await select.evaluate(
		(element: HTMLSelectElement) => element.selectedIndex
	);
	const direction = index >= current ? 'ArrowDown' : 'ArrowUp';
	for (let i = 0; i < Math.abs(index - current); i++)
		await page.keyboard.press(direction);
	await page.keyboard.press('Enter');
}

for (const language of ['en', 'he']) {
	for (const q of ['', '0']) {
		test(`native faculty ${language} query ${JSON.stringify(q)} survives drafts, availability, reset and history`, async ({
			page
		}) => {
			// WebKit renders thousands of broad-query cards during resets and history traversal.
			// Keep the per-assertion deadlines, but allow this whole multi-gesture scenario to finish.
			test.setTimeout(90_000);
			await page.addInitScript(
				(lang) => localStorage.setItem('lang', lang),
				language
			);
			await page.goto(`/app/search?q=${q}`);
			await waitForSearchReady(page);
			await expectSearchFiltersVisible(page);
			const state: State = {
				q,
				faculty: '',
				available: false,
				pointsMax: maxPoints
			};
			await expectResults(page, state);
			for (const faculty of [mechanical, physics, chemistry]) {
				await chooseNativeFaculty(page, faculty);
				state.faculty = faculty;
				await expectResults(page, state);
			}
			// Opening the picker blurs an unfinished numeric input and navigates while it is open.
			await page.locator('#search-points-max-input').fill('5.3');
			await chooseNativeFaculty(page, mechanical);
			state.pointsMax = 5.3;
			state.faculty = mechanical;
			await expectResults(page, state);
			await page.locator('fieldset input[type="checkbox"]').click();
			await chooseNativeFaculty(page, physics);
			state.available = true;
			state.faculty = physics;
			await expectResults(page, state);
			await page.reload();
			await waitForSearchReady(page);
			await expectSearchFiltersVisible(page);
			await expectResults(page, state);
			await page.locator('fieldset button').click();
			const cleared = {
				q,
				faculty: '',
				available: false,
				pointsMax: maxPoints
			};
			await expectResults(page, cleared);
			await page.goBack();
			await expectResults(page, state);
			await page.goForward();
			await expectResults(page, cleared);
		});
	}
}
