import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mediaVariants } from '../src/lib/tutorialMedia';
import { click, createRecording, pause } from './helpers/recording';

const code = '02340114';
const courses = JSON.parse(
	readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
) as Record<string, { name: string; points: number; faculty: string }>;
const course = courses[code];
const copy = {
	en: [
		['Find a course', 'Search by course name or code, then press Enter.'],
		[
			'Check the result',
			'The matching card shows the course name, code and credits.'
		],
		[
			'Filter your search',
			'Choose a faculty to focus your results. The filters stay visible above the cards.'
		],
		['Open the details', 'Select a result to read the full course information.']
	],
	he: [
		['מוצאים קורס', 'מחפשים לפי שם הקורס או מספרו ולוחצים Enter.'],
		[
			'בודקים את התוצאה',
			'הכרטיס המתאים מציג את שם הקורס, מספרו ונקודות הזכות.'
		],
		[
			'מסננים את החיפוש',
			'בוחרים פקולטה כדי למקד את התוצאות. המסננים נשארים גלויים מעל הכרטיסים.'
		],
		['פותחים את הפרטים', 'בוחרים תוצאה כדי לקרוא את המידע המלא על הקורס.']
	]
} as const;

for (const { name, language, theme } of mediaVariants('feature-search')) {
	test(`search feature recording ${language} ${theme}`, async ({
		browser,
		baseURL
	}) => {
		const recording = await createRecording(
			browser,
			baseURL!,
			language,
			theme,
			[[]]
		);
		const { page } = recording;
		const steps = copy[language];
		try {
			await page.goto('/app/plan');
			await expect(page.locator('[data-semester="0"]')).toBeVisible();
			const originalPlan = await page.evaluate(() =>
				localStorage.getItem('userData')
			);
			await recording.start();
			const search = page.locator('.header-search input');
			await recording.caption(steps[0][0], steps[0][1], search);
			await pause(page, 2200);
			await click(page, search);
			await search.pressSequentially(code, {
				delay: process.env.PW_DEMO === 'on' ? 160 : 0
			});
			await search.press('Enter');
			await expect(page).toHaveURL(new RegExp(`/app/search\\?q=${code}`));
			const result = page.locator(`main li[id="${code}"] button.search-result`);
			await expect(result).toHaveCount(1);
			await expect(result.locator('.course-name')).toHaveText(course.name);
			await expect(result.locator('.course-code')).toHaveText(code);
			await expect(result.locator('.course-points')).toContainText(
				String(course.points)
			);
			await result.scrollIntoViewIfNeeded();
			await recording.caption(steps[1][0], steps[1][1], result);
			await recording.frame(`${name}-result`);
			await pause(page, 3200);
			const faculty = page.locator('#search-faculty');
			await faculty.scrollIntoViewIfNeeded();
			await recording.caption(steps[2][0], steps[2][1], faculty);
			await pause(page, 2000);
			expect(course.faculty).toBeTruthy();
			await faculty.selectOption(course.faculty);
			await expect(faculty).toHaveValue(course.faculty);
			await expect
				.poll(() => new URL(page.url()).searchParams.get('faculty'))
				.toBe(course.faculty);
			await expect(result).toBeVisible();
			await expect(page.locator('.search-results > li')).toHaveCount(1);
			await recording.frame(`${name}-poster`);
			await pause(page, 3500);
			await result.scrollIntoViewIfNeeded();
			await recording.caption(steps[3][0], steps[3][1], result);
			await pause(page, 2500);
			await click(page, result);
			await expect(page).toHaveURL(new RegExp(`/app/course/${code}$`));
			await expect(page.locator('h1.course-name')).toHaveText(course.name);
			await expect
				.poll(() => page.evaluate(() => localStorage.getItem('userData')))
				.toBe(originalPlan);
			await recording.frame(`${name}-details`);
			await pause(page, 3000);
			await expect(page.getByTestId('pwa-error-detail')).toHaveCount(0);
			await recording.finish(name);
		} finally {
			await recording.context.close();
		}
	});
}
