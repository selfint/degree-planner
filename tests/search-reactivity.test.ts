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
	points?: number;
	median?: number;
	faculty?: string;
	current?: boolean;
}[];
const maxPoints =
	Math.ceil(Math.max(...courses.map((course) => course.points ?? 0)) * 2) / 2;
const faculty = courses.find((course) => course.code === '01040184')!.faculty!;
type State = {
	q: string;
	available: boolean;
	faculty: string;
	pointsMin: number;
	pointsMax: number;
	medianMin: number;
};
const defaults = (): State => ({
	q: '1040',
	available: false,
	faculty: '',
	pointsMin: 0,
	pointsMax: maxPoints,
	medianMin: 0
});

async function expectState(page: Page, state: State) {
	const params: Record<string, string> = { q: state.q };
	if (state.available) params.available = '';
	if (state.faculty) params.faculty = state.faculty;
	if (state.pointsMin) params.pointsMin = String(state.pointsMin);
	if (state.pointsMax < maxPoints) params.pointsMax = String(state.pointsMax);
	if (state.medianMin) params.medianMin = String(state.medianMin);
	await expect
		.poll(() => Object.fromEntries(new URL(page.url()).searchParams))
		.toEqual(params);
	await expect(page.locator('fieldset input[type="checkbox"]')).toBeChecked({
		checked: state.available
	});
	await expect(page.locator('#search-faculty')).toHaveValue(state.faculty);
	await expect(page.locator('#search-points-min')).toHaveValue(
		String(state.pointsMin)
	);
	await expect(page.locator('#search-points-max')).toHaveValue(
		String(state.pointsMax)
	);
	await expect(page.locator('#search-points-min-input')).toHaveValue(
		state.pointsMin.toFixed(1)
	);
	await expect(page.locator('#search-points-max-input')).toHaveValue(
		state.pointsMax.toFixed(1)
	);
	await expect(
		page.locator('fieldset input[type="number"]').last()
	).toHaveValue(state.medianMin.toFixed(1));
	const matches = courses.filter(
		(c) =>
			c.code.includes(state.q) ||
			c.name?.includes(state.q) ||
			c.about?.includes(state.q)
	);
	const expected = matches
		.filter(
			(c) =>
				(!state.available || c.current) &&
				(!state.faculty || c.faculty === state.faculty) &&
				((state.pointsMin === 0 && state.pointsMax === maxPoints) ||
					(c.points !== undefined &&
						c.points >= state.pointsMin &&
						c.points <= state.pointsMax)) &&
				(state.medianMin === 0 ||
					(c.median !== undefined && c.median >= state.medianMin))
		)
		.sort((a, b) => (b.median ?? 0) - (a.median ?? 0));
	await expect
		.poll(() =>
			page
				.locator('main ul > li')
				.evaluateAll((items) => items.map((item) => item.id))
		)
		.toEqual(expected.map((c) => c.code));
	const status = await page.locator('main p[role="status"]').innerText();
	expect(Number(status.match(/^\d+/)?.[0])).toBe(expected.length);
	if (expected.length !== matches.length)
		expect(status).toContain(String(matches.length));
}

test.beforeEach(async ({ page }, testInfo) => {
	await page.addInitScript(
		(lang) => {
			localStorage.setItem('lang', lang);
			localStorage.setItem('version', '4');
			localStorage.setItem(
				'userData',
				JSON.stringify({
					semesters: [[]],
					currentSemester: 0,
					exemptions: [],
					wishlist: [],
					degree: ['2024_200', '00002120', 'SC00001320_CG00006382']
				})
			);
		},
		testInfo.title.includes('Hebrew') ? 'he' : 'en'
	);
});

test('preserves every filter when slider changes and availability arrive before navigation settles', async ({
	page
}) => {
	await page.goto('/search?q=1040&pointsMin=1&pointsMax=6');
	await expect(page.locator('#search-points-min')).toHaveValue('1');
	// A synchronous burst deliberately exercises the interval that waiting for each URL hides.
	await page.locator('fieldset').evaluate((fieldset) => {
		for (const [id, value] of [
			['search-points-min', '3'],
			['search-points-max', '5']
		]) {
			const input = fieldset.querySelector<HTMLInputElement>(`#${id}`)!;
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}
		fieldset.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
	});
	await expect
		.poll(() => Object.fromEntries(new URL(page.url()).searchParams))
		.toEqual({
			q: '1040',
			available: '',
			pointsMin: '3',
			pointsMax: '5'
		});
	await expect(page.locator('#search-points-min')).toHaveValue('3');
	await expect(page.locator('#search-points-max')).toHaveValue('5');
	await expectState(page, {
		...defaults(),
		available: true,
		pointsMin: 3,
		pointsMax: 5
	});
});

// Balanced orders cover every ordered pair of adjacent operations, not just availability first.
const actions = [
	'available',
	'faculty',
	'pointsMin',
	'pointsMax',
	'medianMin',
	'q'
] as const;
for (const language of ['English', 'Hebrew']) {
	for (let row = 0; row < actions.length; row++) {
		const order = [0, 1, 5, 2, 4, 3].map(
			(index) => actions[(index + row) % actions.length]
		);
		test(`${language} filter order ${order.join(' → ')} keeps controls, URL and results aligned`, async ({
			page
		}) => {
			if (language === 'Hebrew')
				await page.setViewportSize({ width: 320, height: 812 });
			await page.goto('/search?q=1040');
			let state = defaults();
			await expectState(page, state);
			const history = [{ ...state }];
			for (const action of order) {
				if (action === 'available') {
					await page.locator('fieldset input[type="checkbox"]').check();
					state.available = true;
				}
				if (action === 'faculty') {
					await page.locator('#search-faculty').selectOption(faculty);
					state.faculty = faculty;
				}
				if (action === 'pointsMin') {
					if (row % 2 === 0) {
						await page.locator('#search-points-min-input').fill('3.24');
						await page.locator('#search-points-min-input').press('Enter');
						state.pointsMin = 3.2;
					} else {
						await page
							.locator('#search-points-min')
							.evaluate((input: HTMLInputElement) => {
								input.value = '3.1';
								input.dispatchEvent(new Event('input', { bubbles: true }));
								input.dispatchEvent(new Event('change', { bubbles: true }));
							});
						state.pointsMin = 3;
					}
				}
				if (action === 'pointsMax') {
					await page.locator('#search-points-max-input').fill('5');
					await page.locator('#search-points-max-input').press('Enter');
					state.pointsMax = 5;
				}
				if (action === 'medianMin') {
					await page
						.locator('fieldset input[type="number"]')
						.last()
						.fill('85.12');
					await page
						.locator('fieldset input[type="number"]')
						.last()
						.press('Enter');
					state.medianMin = 85.1;
				}
				if (action === 'q') {
					await page.locator('header input[type="text"]').fill('0104');
					await page.locator('header input[type="text"]').press('Enter');
					state.q = '0104';
				}
				await expectState(page, state);
				history.push({ ...state });
			}
			for (const available of [false, true, false, true]) {
				await page
					.locator('fieldset input[type="checkbox"]')
					.setChecked(available);
				state.available = available;
				await expectState(page, state);
			}
			await page.reload();
			await expectState(page, state);
			await page.locator('fieldset button').click();
			await expectState(page, { ...defaults(), q: state.q });
			await page.goBack();
			await expectState(page, state);
			await page.goForward();
			await expectState(page, { ...defaults(), q: state.q });
			// Reset history is separate from edit history; walk through each original change as well.
			await page.goBack();
			for (let i = 0; i < 4; i++) await page.goBack();
			await expectState(page, history.at(-1)!);
			for (let i = history.length - 2; i >= 0; i--) {
				await page.goBack();
				await expectState(page, history[i]);
			}
			await page.goForward();
			await expectState(page, history[1]);
		});
	}

	test(`${language} number blur followed directly by another control preserves both changes`, async ({
		page
	}) => {
		if (language === 'Hebrew')
			await page.setViewportSize({ width: 320, height: 812 });
		for (const field of ['pointsMin', 'pointsMax', 'medianMin'] as const) {
			for (const target of [
				'available',
				'faculty',
				'query',
				'clear'
			] as const) {
				await page.goto('/search?q=1040&pointsMin=1&pointsMax=6&medianMin=80');
				const state = {
					...defaults(),
					pointsMin: 1,
					pointsMax: 6,
					medianMin: 80
				};
				await expectState(page, state);
				const input =
					field === 'medianMin'
						? page.locator('fieldset input[type="number"]').last()
						: page.locator(
								`#search-points-${field === 'pointsMin' ? 'min' : 'max'}-input`
							);
				const value =
					field === 'pointsMin' ? 3.2 : field === 'pointsMax' ? 5.3 : 85.1;
				await input.fill(String(value));
				state[field] = value;
				if (target === 'available') {
					await page.locator('fieldset input[type="checkbox"]').click();
					state.available = true;
				}
				if (target === 'faculty') {
					await page.locator('#search-faculty').click();
					await page.locator('#search-faculty').selectOption(faculty);
					state.faculty = faculty;
				}
				if (target === 'query') {
					await page.locator('header input[type="text"]').fill('0104');
					await page.locator('header input[type="text"]').press('Enter');
					state.q = '0104';
				}
				if (target === 'clear') {
					await page.locator('fieldset button').click();
					Object.assign(state, defaults());
				}
				await expectState(page, state);
			}
		}
	});
}

test('rapid mixed changes, query, clear and later edits never restore a stale snapshot', async ({
	page
}) => {
	await page.goto('/search?q=1040&pointsMin=1&pointsMax=6');
	await expect(page.locator('#search-points-min')).toHaveValue('1');
	await page.locator('body').evaluate((body, faculty) => {
		const number = (selector: string, value: string) => {
			const input = body.querySelector<HTMLInputElement>(selector)!;
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			input.dispatchEvent(new FocusEvent('blur'));
		};
		number('#search-points-min-input', '3.2');
		number('#search-points-max-input', '5.3');
		const select = body.querySelector<HTMLSelectElement>('#search-faculty')!;
		select.value = faculty;
		select.dispatchEvent(new Event('change', { bubbles: true }));
		const search = body.querySelector<HTMLInputElement>(
			'header input[type="text"]'
		)!;
		search.value = '0104';
		search.dispatchEvent(new Event('input', { bubbles: true }));
		search.form!.requestSubmit();
		body.querySelector<HTMLButtonElement>('fieldset button')!.click();
		number('#search-points-min-input', '2.3');
		body
			.querySelector<HTMLInputElement>('fieldset input[type="checkbox"]')!
			.click();
	}, faculty);
	await expectState(page, {
		...defaults(),
		q: '0104',
		pointsMin: 2.3,
		available: true
	});
	await page.reload();
	await expectState(page, {
		...defaults(),
		q: '0104',
		pointsMin: 2.3,
		available: true
	});
});

test('Back and Forward discard an unfinished draft even when the committed points are identical', async ({
	page
}) => {
	await page.goto('/search?q=1040&pointsMin=3&pointsMax=5');
	let state = { ...defaults(), pointsMin: 3, pointsMax: 5 };
	await expectState(page, state);
	await page.locator('fieldset input[type="checkbox"]').check();
	state = { ...state, available: true };
	await expectState(page, state);
	await page.locator('#search-points-min-input').fill('4.2');
	await page.goBack();
	await expectState(page, { ...state, available: false });
	await page.goForward();
	await expectState(page, state);
});

test('an unrelated checkbox update cannot reset an unfinished slider gesture', async ({
	page
}) => {
	await page.goto('/search?q=1040&pointsMin=3&pointsMax=5');
	await expectState(page, { ...defaults(), pointsMin: 3, pointsMax: 5 });
	const slider = page.locator('#search-points-min');
	await slider.evaluate((input: HTMLInputElement) => {
		input.value = '3.5';
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await page.locator('fieldset input[type="checkbox"]').check();
	await expect(page).toHaveURL(/available/);
	await expect(slider).toHaveValue('3.5');
	await expect(page.locator('#search-points-min-input')).toHaveValue('3.5');
	await slider.dispatchEvent('change');
	await expectState(page, {
		...defaults(),
		pointsMin: 3.5,
		pointsMax: 5,
		available: true
	});
});

test('Clear accepts the first click when only an unfinished numeric draft is active', async ({
	page
}) => {
	for (const selector of [
		'#search-points-min-input',
		'#search-points-max-input',
		'fieldset input[type="number"]:last-of-type'
	]) {
		await page.goto('/search?q=1040');
		await expectState(page, defaults());
		const input = selector.startsWith('fieldset')
			? page.locator('fieldset input[type="number"]').last()
			: page.locator(selector);
		await input.fill(
			selector.includes('min-input')
				? '3.2'
				: selector.includes('max-input')
					? '5.3'
					: '85.1'
		);
		await page.locator('fieldset button').click();
		await expectState(page, defaults());
	}
});

test('same-batch numeric and slider edits followed by Clear restore every native control', async ({
	page
}) => {
	for (const mode of ['number', 'range']) {
		await page.goto('/search?q=1040&available');
		await expectState(page, { ...defaults(), available: true });
		await page.locator('fieldset').evaluate((fieldset, mode) => {
			const inputs = Array.from(
				fieldset.querySelectorAll<HTMLInputElement>(`input[type="${mode}"]`)
			);
			inputs.forEach((input, index) => {
				input.value = String(index === 0 ? 3.2 : index === 1 ? 5.3 : 85.1);
				input.dispatchEvent(new Event('input', { bubbles: true }));
				input.dispatchEvent(
					mode === 'number'
						? new FocusEvent('blur')
						: new Event('change', { bubbles: true })
				);
			});
			fieldset.querySelector<HTMLButtonElement>('button')!.click();
		}, mode);
		await expectState(page, defaults());
	}
});
