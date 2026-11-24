import { expect, test } from '@playwright/test';
import { mockCourseData } from './helpers/course-data-fixture';

const classification = '01130013';
const physics = '01140077';
const mechanics = '00140102';
const fixture = {
	[mechanics]: {
		code: mechanics,
		name: 'Engineering Mechanics',
		current: true,
		connections: { dependencies: [[classification], [physics]] }
	},
	[physics]: { code: physics, name: 'Physics 1L', current: true }
};

const scenarios = [
	{
		name: 'classification only',
		exemptions: [classification],
		completed: [],
		eligible: true
	},
	{
		name: 'Physics 1L only',
		exemptions: [],
		completed: [physics],
		eligible: true
	},
	{
		name: 'both',
		exemptions: [classification],
		completed: [physics],
		eligible: true
	},
	{ name: 'neither', exemptions: [], completed: [], eligible: false }
];

for (const { name, exemptions, completed, eligible } of scenarios) {
	test(`Plan and Semester agree on Mechanics eligibility: ${name}`, async ({
		page
	}) => {
		await page.route('**/*', (route) =>
			new URL(route.request().url()).origin === 'http://localhost:4173'
				? route.continue()
				: route.abort()
		);
		await page.addInitScript(
			({ exemptions, completed, mechanics }) => {
				localStorage.setItem('lang', 'en');
				localStorage.setItem('version', '4');
				localStorage.setItem(
					'userData',
					JSON.stringify({
						exemptions,
						semesters: [completed, [mechanics]],
						currentSemester: 0,
						wishlist: []
					})
				);
			},
			{ exemptions, completed, mechanics }
		);
		const snapshotReads = await mockCourseData(page, fixture);
		// Ensure startup uses the fixture rather than server-embedded catalog data.
		await page.route('**/app/plan', async (route) => {
			const response = await route.fetch();
			const body = (await response.text()).replace(
				/<script[^>]*data-sveltekit-fetched[^>]*data-url="\/courseDataStripped\.json"[^>]*>.*?<\/script>/s,
				''
			);
			await route.fulfill({ response, body });
		});
		await page.goto('/app/plan');
		await expect.poll(snapshotReads).toBeGreaterThan(0);
		const planned = page.locator(`[data-code="${mechanics}"]`);
		await expect(
			planned.getByText('Engineering Mechanics', { exact: true })
		).toBeVisible();
		const warning = planned.getByRole('button', {
			name: 'Course requirement details'
		});
		await expect(warning).toHaveCount(eligible ? 0 : 1);
		if (!eligible) {
			await warning.click();
			await expect(
				planned.getByText('Physics 1L', { exact: true })
			).toBeVisible();
		}

		await page.locator('a[href="/app/semester?c=0"]').click();
		await expect(page).toHaveURL(/\/app\/semester\?c=0$/);
		const suggestion = page
			.locator('.semester-page .course-card:visible')
			.filter({
				has: page.getByText('Engineering Mechanics', { exact: true })
			});
		await expect(suggestion).toBeVisible();
		if (eligible) {
			await expect(suggestion.locator('.course-note')).not.toContainText('📚');
			await expect(suggestion).toHaveCSS('opacity', '1');
		} else {
			await expect(suggestion.locator('.course-note')).toContainText('📚');
			await expect(suggestion).toHaveCSS('opacity', '0.6');
		}
	});
}
