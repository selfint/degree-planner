import { expect, test } from '@playwright/test';

test('index page has website title', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Technion Course Plot' })).toBeVisible();
});

test('courses displayed', async ({ page }) => {
	await page.goto('/');

	// Locate the textarea and fill it with text
	const textBlob = `'קנ
    236306 םיירקמ םיפרג 2.0
    236309 הניפצה תרותל אובמ 3.0
    236313 תויכוביסה תרות 3.0
    236315 בשחמה יעדמב תוירבגלא תוטיש 3.0
    236318 תוינאילוב תויצקנופ לש הזילנא 2.0
    236359 םימתירוגלא 2 3.0
    236374 םימתירוגלאו תויתורבתסה תוטיש 3.0
    236377 םיפרגב םירזובמ םימתירוגלא 3.0
    236378 לוהינ תונורקע תואדו רסח עדימ 2.0
    236508 תויכוביסו היפרגוטפירק 2.0
    236518 תרושקת תויכוביס 2.0
    236521 ק ימתירוגלא י בור 2.0
    236525`;
	const codes = [
		'236306',
		'236309',
		'236313',
		'236315',
		'236318',
		'236359',
		'236374',
		'236377',
		'236378',
		'236508',
		'236518',
		'236521',
		'236525'
	];
	await page.fill('textarea', textBlob);

	// Locate the submit button and click it
	await page.click('button[type="submit"]');

	// Wait for the parsed courses to be displayed
	await page.waitForSelector('progress');
	await page.waitForFunction(() => !document.querySelector('progress'));

	// Assert that the courses are displayed
	const coursesList = page.locator('tr');
	const coursesCount = await coursesList.count();

	// Ensure at least one course is displayed (adjust according to your catalog parsing logic)
	expect(coursesCount).toStrictEqual(codes.length + 1);
});

test('courses medians displayed', async ({ page }) => {
	await page.goto('/');

	await page.fill('textarea', '234329');

	// Locate the submit button and click it
	await page.click('button[type="submit"]');

	// Wait for the parsed courses to be displayed
	await page.waitForSelector('progress');
	await page.waitForFunction(() => !document.querySelector('progress'));

	// Assert that the courses are displayed
	const coursesList = page.locator('tr');
	const coursesCount = await coursesList.count();

	// Ensure at least one course is displayed (adjust according to your catalog parsing logic)
	expect(coursesCount).toStrictEqual(1 + 1);

	const courseContent = await coursesList.nth(1).textContent();
	expect(courseContent).toContain('99.6');
});
