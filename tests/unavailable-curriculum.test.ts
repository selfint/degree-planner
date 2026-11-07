import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initializeGuestStorage } from './helpers/student-guest-storage';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const original = JSON.parse(readFileSync('static/catalogs.json', 'utf8'));
const semester = '2024_201';
const faculty = '00002330';
const program = 'SC00001355_CG00007976';
const degree = [semester, faculty, program];
const manifest = structuredClone(original);
// Keep this fixture valid after the next Data PR removes the real option.
for (const year of ['2024_200', semester]) {
	manifest[year] ??= { en: year, he: year };
	manifest[year][faculty] ??= {
		en: 'Biomedical Engineering',
		he: 'הנדסה ביו-רפואית'
	};
}
manifest['2024_200'][faculty][program] = {
	en: 'Biomedical Engineering and Physics',
	he: 'הנדסה ביו-רפואית ופיזיקה'
};
delete manifest[semester][faculty][program];
const replacementRequirement = {
	name: 'requirement',
	en: 'Available curriculum',
	he: 'תוכנית זמינה',
	nested: [
		{ name: 'CG00007978', en: 'Mandatory', he: 'חובה', courses: ['02340124'] }
	]
};

for (const language of ['en', 'he']) {
	test(`saved unavailable curriculum preserves the plan and allows replacement (${language})`, async ({
		context,
		page
	}) => {
		const saved = {
			degree,
			exemptions: ['01040031'],
			semesters: [['02340124'], [], ['02340141']],
			currentSemester: 0,
			wishlist: ['01040184']
		};
		const errors: string[] = [];
		const removedRequests: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await context.addInitScript(initializeGuestStorage, {
			origin,
			language,
			seed: saved
		});
		await context.route('**/*', async (route) => {
			const url = new URL(route.request().url());
			if (url.origin !== origin) return route.abort();
			if (url.pathname === '/catalogs.json')
				return route.fulfill({ json: manifest });
			if (
				url.pathname ===
				`/_catalogs/2024_200/${faculty}/${program}/requirementsData.json`
			)
				return route.fulfill({ json: replacementRequirement });
			if (url.pathname.includes(`/_catalogs/${degree.join('/')}/`)) {
				removedRequests.push(url.pathname);
				return route.fulfill({ status: 404, body: 'Unavailable' });
			}
			return route.continue();
		});
		for (const path of [
			'/app/catalog',
			'/app/semester',
			'/app/course/02340124'
		]) {
			await page.goto(origin + path);
			await expect(page.getByTestId('curriculum-unavailable')).toBeVisible();
			expect(
				await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
			).toEqual(saved);
		}
		await page.goto(origin + '/app/plan');
		await expect(page.locator('.semester-courses').first()).toBeVisible();
		expect(
			await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
		).toEqual(saved);
		await page.goto(origin + '/app/settings');
		const selects = page.locator('.degree-fields select');
		await expect(selects.first()).toBeVisible();
		expect(
			await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
		).toEqual(saved);
		await expect(
			selects.nth(2).locator(`option[value="${program}"]`)
		).toHaveCount(0);
		// Select the same degree in an unaffected semester; keep every planned course.
		await selects.first().selectOption('2024_200');
		await selects.nth(1).selectOption(faculty);
		await selects.nth(2).selectOption(program);
		const save = page
			.locator('.degree-section .section-actions button')
			.first();
		await expect(save).toBeEnabled();
		await save.click();
		await expect
			.poll(async () =>
				page.evaluate(
					() => JSON.parse(localStorage.getItem('userData')!).degree
				)
			)
			.toEqual(['2024_200', faculty, program]);
		const updated = await page.evaluate(() =>
			JSON.parse(localStorage.getItem('userData')!)
		);
		expect(updated).toEqual({
			...saved,
			degree: ['2024_200', faculty, program]
		});
		expect(errors).toEqual([]);
		expect(removedRequests).toEqual([]);
	});
}
