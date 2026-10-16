import { expect, test, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';

const courseData = JSON.parse(
	readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
);

async function setRange(slider: Locator, value: string) {
	await expect(slider).toBeEnabled();
	await slider.evaluate((element, value) => {
		(element as HTMLInputElement).value = value;
		element.dispatchEvent(new Event('input', { bubbles: true }));
	}, value);
}

const courses = Object.values(courseData) as {
	code: string;
	name?: string;
	about?: string;
	faculty?: string;
	points?: number;
	median?: number;
	current?: boolean;
}[];
const query = '1040';
const matches = courses.filter(
	(course) =>
		course.code.includes(query) ||
		course.name?.includes(query) ||
		course.about?.includes(query)
);
const maxPoints =
	Math.ceil(Math.max(...courses.map((course) => course.points ?? 0)) * 2) / 2;
const mathFaculty = courses.find(
	(course) => course.code === '01040184'
)!.faculty!;

test.beforeEach(async ({ page }, testInfo) => {
	const language = testInfo.title.includes('Hebrew') ? 'he' : 'en';
	await page.addInitScript(
		(lang) => localStorage.setItem('lang', lang),
		language
	);
});

test('combines filters, counts only displayed courses, and restores state after reload', async ({
	page
}) => {
	await page.goto(`/search?q=${query}`);
	await expect(page.locator('main p[role="status"]')).toHaveText(
		`${matches.length} results found`
	);
	await page.getByLabel('Available', { exact: true }).check();
	await expect(page).toHaveURL(/available/);
	await page.getByLabel('Faculty', { exact: true }).selectOption(mathFaculty);
	await expect(page).toHaveURL(/faculty=/);
	const min = page.getByRole('slider', { name: 'Min points' });
	const max = page.getByRole('slider', { name: 'Max points' });
	await setRange(min, '2');
	await min.dispatchEvent('change');
	await expect(page).toHaveURL(/pointsMin=2/);
	await setRange(max, '4');
	await max.dispatchEvent('change');
	await expect(page).toHaveURL(/pointsMax=4/);
	await page.getByRole('spinbutton', { name: 'Min median' }).fill('85');
	await page.getByRole('spinbutton', { name: 'Min median' }).press('Tab');
	await expect(page).toHaveURL(/medianMin=85/);
	const expected = matches
		.filter(
			(course) =>
				course.current &&
				course.faculty === mathFaculty &&
				course.points !== undefined &&
				course.points >= 2 &&
				course.points <= 4 &&
				course.median !== undefined &&
				course.median >= 85
		)
		.sort((a, b) => (b.median ?? 0) - (a.median ?? 0));
	await expect(page.locator('main p[role="status"]')).toHaveText(
		`${expected.length} results found (of ${matches.length})`
	);
	await expect(
		page.getByRole('list', { name: 'Results for' }).locator(':scope > li')
	).toHaveCount(expected.length);
	expect(
		await page
			.getByRole('list', { name: 'Results for' })
			.locator(':scope > li')
			.evaluateAll((items) => items.map((item) => item.id))
	).toEqual(expected.map((course) => course.code));
	await page.reload();
	await expect(page.getByLabel('Available', { exact: true })).toBeChecked();
	await expect(page.getByLabel('Faculty', { exact: true })).toHaveValue(
		mathFaculty
	);
	await expect(min).toHaveValue('2');
	await expect(max).toHaveValue('4');
	await expect(
		page.getByRole('spinbutton', { name: 'Min median' })
	).toHaveValue('85');
	await expect(page.locator('main p[role="status"]')).toHaveText(
		`${expected.length} results found (of ${matches.length})`
	);
});

test('commits a slider gesture once, clears filters without losing the query, and supports history', async ({
	page
}) => {
	await page.goto(
		`/search?q=${query}&available&faculty=${encodeURIComponent(mathFaculty)}`
	);
	const original = page.url();
	const slider = page.getByRole('slider', { name: 'Min points' });
	await expect(slider).toHaveValue('0');
	const historyLength = await page.evaluate(() => history.length);
	await setRange(slider, '1');
	await setRange(slider, '2');
	await expect(page).toHaveURL(original);
	await expect(
		page.getByRole('spinbutton', { name: 'Min points' })
	).toHaveValue('2');
	await slider.dispatchEvent('change');
	await expect(page).toHaveURL(/pointsMin=2/);
	expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);
	await page.getByRole('button', { name: 'Clear filters' }).click();
	await expect(page).toHaveURL(new RegExp(`/search\\?q=${query}$`));
	await expect(slider).toHaveValue('0');
	await expect(page.getByRole('slider', { name: 'Max points' })).toHaveValue(
		String(maxPoints)
	);
	await expect(
		page.getByRole('button', { name: 'Clear filters' })
	).toBeDisabled();
	await page.goBack();
	await expect(slider).toHaveValue('2');
	await expect(page.getByLabel('Available', { exact: true })).toBeChecked();
	await page.goBack();
	await expect(page).toHaveURL(original);
	await expect(slider).toHaveValue('0');
	await page.goForward();
	await expect(slider).toHaveValue('2');
});

test('handles malformed URLs, zero median, and an empty result set', async ({
	page
}) => {
	await page.goto(
		`/search?q=${query}&pointsMin=NaN&pointsMax=Infinity&medianMin=0`
	);
	await expect(page.getByRole('slider', { name: 'Min points' })).toHaveValue(
		'0'
	);
	await expect(page.getByRole('slider', { name: 'Max points' })).toHaveValue(
		String(maxPoints)
	);
	await expect(page.locator('main p[role="status"]')).toHaveText(
		`${matches.length} results found`
	);
	await page.getByRole('spinbutton', { name: 'Min median' }).fill('120');
	await page.getByRole('spinbutton', { name: 'Min median' }).press('Tab');
	await expect(
		page.getByRole('spinbutton', { name: 'Min median' })
	).toHaveValue('100');
	await expect(page).toHaveURL(/medianMin=100/);
	await page.goto(`/search?q=${query}&faculty=Unknown`);
	await expect(page.getByLabel('Faculty', { exact: true })).toHaveValue(
		'Unknown'
	);
	await expect(page.locator('main p[role="status"]')).toHaveText(
		`0 results found (of ${matches.length})`
	);
	await expect(
		page.getByText('No courses match this search.', { exact: false })
	).toBeVisible();
	await page.getByRole('button', { name: 'Clear filters' }).click();
	await expect(page.locator('main p[role="status"]')).toHaveText(
		`${matches.length} results found`
	);
});

test('keeps filters when submitting a new query and encodes reserved characters', async ({
	page
}) => {
	await page.addInitScript(() => {
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
	});
	await page.goto(`/search?q=${query}&available&pointsMin=2`);
	const input = page.locator('header input[type="text"]');
	await input.fill('A&B + #?');
	await input.press('Enter');
	await expect(
		page.getByRole('heading', { name: 'Results for "A&B + #?"' })
	).toBeVisible();
	const params = new URL(page.url()).searchParams;
	expect(params.get('q')).toBe('A&B + #?');
	expect(params.has('available')).toBe(true);
	expect(params.get('pointsMin')).toBe('2');
	await page.goBack();
	await expect(
		page.getByRole('heading', { name: `Results for "${query}"` })
	).toBeVisible();
});

test('renders labeled Hebrew controls without horizontal overflow on mobile', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 812 });
	await page.goto('/search?q=104184&medianMin=85');
	await expect(
		page.getByRole('heading', { name: 'תוצאות עבור "01040184"' })
	).toBeVisible();
	await expect(page.getByLabel('פקולטה', { exact: true })).toBeVisible();
	await expect(
		page.getByRole('slider', { name: 'מינימום נקודות' })
	).toBeVisible();
	await expect(
		page.getByRole('spinbutton', { name: 'חציון מינימלי' })
	).toHaveValue('85');
	const layout = await page.evaluate(() => ({
		width: innerWidth,
		scrollWidth: document.documentElement.scrollWidth,
		overflow: Array.from(document.querySelectorAll('body *'))
			.filter((element) => {
				const rect = element.getBoundingClientRect();
				return rect.width > 0 && (rect.left < 0 || rect.right > innerWidth);
			})
			.map((element) => `${element.tagName}#${element.id}.${element.className}`)
	}));
	expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
		layout.width
	);
});

test('supports precise decimal fields on mobile with slider, URL, reload, and history sync', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 812 });
	await page.goto(`/search?q=${query}`);
	const minInput = page.getByRole('spinbutton', { name: 'Min points' });
	const maxInput = page.getByRole('spinbutton', { name: 'Max points' });
	const medianInput = page.getByRole('spinbutton', { name: 'Min median' });
	const minSlider = page.getByRole('slider', { name: 'Min points' });
	const maxSlider = page.getByRole('slider', { name: 'Max points' });
	for (const input of [minInput, maxInput, medianInput]) {
		await expect(input).toHaveAttribute('type', 'number');
		await expect(input).toHaveAttribute('inputmode', 'decimal');
		await expect(input).toHaveAttribute('step', 'any');
	}
	const originalUrl = page.url();
	await minInput.fill('');
	await expect(minInput).toHaveValue('');
	await expect(page).toHaveURL(originalUrl);
	await minInput.pressSequentially('2.25');
	await expect(minInput).toHaveValue('2.25');
	await expect(minSlider).toHaveValue('2.25');
	await expect(page).toHaveURL(originalUrl);
	await minInput.press('Enter');
	await expect(page).toHaveURL(/pointsMin=2.25/);
	await maxInput.fill('4.75');
	await maxInput.press('Tab');
	await expect(page).toHaveURL(/pointsMax=4.75/);
	await medianInput.fill('85.125');
	await medianInput.press('Enter');
	await expect(page).toHaveURL(/medianMin=85.125/);
	await expect(maxSlider).toHaveValue('4.75');
	const expected = matches.filter(
		(course) =>
			course.points !== undefined &&
			course.points >= 2.25 &&
			course.points <= 4.75 &&
			course.median !== undefined &&
			course.median >= 85.125
	);
	await expect(
		page.getByRole('list', { name: 'Results for' }).locator(':scope > li')
	).toHaveCount(expected.length);
	const layout = await page.evaluate(() => ({
		width: innerWidth,
		scrollWidth: document.documentElement.scrollWidth,
		overflow: Array.from(document.querySelectorAll('body *'))
			.filter((element) => {
				const rect = element.getBoundingClientRect();
				return rect.width > 0 && (rect.left < 0 || rect.right > innerWidth);
			})
			.map((element) => `${element.tagName}#${element.id}.${element.className}`)
	}));
	expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
		layout.width
	);
	await page.reload();
	await expect(minInput).toHaveValue('2.25');
	await expect(maxInput).toHaveValue('4.75');
	await expect(medianInput).toHaveValue('85.125');
	await expect(minSlider).toHaveValue('2.25');
	await expect(maxSlider).toHaveValue('4.75');
	await setRange(minSlider, '2.5');
	await expect(minInput).toHaveValue('2.5');
	await minSlider.dispatchEvent('change');
	await expect(page).toHaveURL(/pointsMin=2.5/);
	await page.goBack();
	await expect(minInput).toHaveValue('2.25');
	await expect(minSlider).toHaveValue('2.25');
	await page.goForward();
	await expect(minInput).toHaveValue('2.5');
	await page.getByRole('button', { name: 'Clear filters' }).click();
	await expect(minInput).toHaveValue('0');
	await expect(maxInput).toHaveValue(String(maxPoints));
	await expect(medianInput).toHaveValue('0');
});

test('normalizes numeric fields only when committed and handles empty, invalid, and crossed bounds', async ({
	page
}) => {
	await page.goto(
		`/search?q=${query}&pointsMin=1.25&pointsMax=4.75&medianMin=90.5`
	);
	const minInput = page.getByRole('spinbutton', { name: 'Min points' });
	const maxInput = page.getByRole('spinbutton', { name: 'Max points' });
	const medianInput = page.getByRole('spinbutton', { name: 'Min median' });
	const minSlider = page.getByRole('slider', { name: 'Min points' });
	const originalUrl = page.url();
	await minInput.fill('');
	await minInput.pressSequentially('1e');
	expect(
		await minInput.evaluate(
			(input: HTMLInputElement) => input.validity.badInput
		)
	).toBe(true);
	await expect(page).toHaveURL(originalUrl);
	await minInput.press('Tab');
	await expect(minInput).toHaveValue('1.25');
	await expect(minSlider).toHaveValue('1.25');
	await expect(page).toHaveURL(originalUrl);
	await minInput.fill('');
	await expect(minInput).toHaveValue('');
	await expect(page).toHaveURL(originalUrl);
	await minInput.press('Tab');
	await expect(minInput).toHaveValue('0');
	await expect(page).not.toHaveURL(/pointsMin=/);
	await minInput.fill('999');
	await expect(minInput).toHaveValue('999');
	await expect(page).not.toHaveURL(/pointsMin=/);
	await minInput.press('Enter');
	await expect(minInput).toHaveValue('4.75');
	await expect(minSlider).toHaveValue('4.75');
	await expect(page).toHaveURL(/pointsMin=4.75/);
	await maxInput.fill('-2');
	await maxInput.press('Tab');
	await expect(maxInput).toHaveValue('4.75');
	await minInput.fill('-3.5');
	await minInput.press('Tab');
	await expect(minInput).toHaveValue('0');
	await maxInput.fill('');
	await expect(maxInput).toHaveValue('');
	await maxInput.press('Enter');
	await expect(maxInput).toHaveValue(String(maxPoints));
	await expect(page).not.toHaveURL(/pointsMax=/);
	await medianInput.fill('150.5');
	await medianInput.press('Tab');
	await expect(medianInput).toHaveValue('100');
	await medianInput.fill('');
	await expect(medianInput).toHaveValue('');
	await expect(page).toHaveURL(/medianMin=100/);
	await medianInput.press('Tab');
	await expect(medianInput).toHaveValue('0');
	await expect(page).not.toHaveURL(/medianMin=/);
});
