import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { tutorialCopy } from '../src/lib/tutorials';
import {
	click,
	createRecording,
	pause,
	type Language,
	type Theme
} from './helpers/recording';

const courses: Record<
	string,
	{
		name: string;
		median: number;
		points: number;
		tests: unknown[];
		connections: { dependencies: string[][] };
	}
> = JSON.parse(
	readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
);
const cardCode = '02340118';
const planCode = '02340114';

for (const language of ['en', 'he'] as Language[]) {
	for (const theme of ['light', 'dark'] as Theme[]) {
		test(`course card tutorial ${language} ${theme}`, async ({
			browser,
			baseURL
		}) => {
			const recording = await createRecording(
				browser,
				baseURL!,
				language,
				theme,
				[[cardCode], [], []]
			);
			const { page } = recording;
			try {
				await page.goto('/app/plan');
				const card = page.locator(
					`[data-semester="0"] [data-code="${cardCode}"] .course-card`
				);
				await expect(card.locator('.course-name')).toHaveText(
					courses[cardCode].name
				);
				await expect(card.locator('.course-code')).toHaveText(cardCode);
				await expect(card.locator('.course-median')).toContainText(
					String(courses[cardCode].median)
				);
				await expect(card.locator('.course-points')).toContainText(
					String(courses[cardCode].points)
				);
				expect(courses[cardCode].tests.length).toBeGreaterThan(0);
				await expect(card.locator('.course-marker')).toHaveClass(
					/rounded-full/
				);
				await expect(card.locator('.course-warning')).toBeVisible();
				await expect(card.locator('.course-warning')).toHaveAttribute(
					'aria-expanded',
					'false'
				);
				await recording.start();
				await recording.caption(
					tutorialCopy[language]['course-card'].title,
					language === 'he'
						? 'כרטיס קטן, כל הפרטים החשובים.'
						: 'One compact card, all the important details.'
				);
				await recording.frame(`course-card-${language}-${theme}-wide`);
				await pause(page, 1200);
				const box = await card.boundingBox();
				expect(box).not.toBeNull();
				await page.evaluate(({ x, y, width, height }) => {
					const shell = document.querySelector<HTMLElement>('.console-shell')!;
					document.body.style.overflow = 'hidden';
					shell.style.transformOrigin = '0 0';
					shell.style.transition = 'transform 1200ms cubic-bezier(.2,.8,.2,1)';
					shell.style.transform = `translate(${480 - (x + width / 2) * 2.6}px, ${260 - (y + height / 2) * 2.6}px) scale(2.6)`;
				}, box!);
				await expect
					.poll(async () => (await card.boundingBox())!.width)
					.toBeCloseTo(box!.width * 2.6, 0);
				const selectors = [
					'.course-markers',
					'.course-median',
					'.course-points',
					'.course-name',
					'.course-code',
					'.course-warning'
				];
				for (const [i, step] of tutorialCopy[language][
					'course-card'
				].steps.entries()) {
					await recording.caption(
						step.title,
						step.text,
						card.locator(selectors[i])
					);
					await recording.frame(
						`course-card-${language}-${theme}-step-${i + 1}`
					);
					if (i === 0)
						await recording.frame(`course-card-${language}-${theme}-poster`);
					await pause(page, i === 0 || i === 5 ? 4200 : 3200);
				}
				// Reveal the real interactive warning after the close-up; it must
				// describe actual unmet prerequisites from the checked-in catalog.
				await page.locator('.console-shell').evaluate((node) => {
					(node as HTMLElement).style.transform = 'none';
				});
				await expect
					.poll(async () => (await card.boundingBox())!.width)
					.toBeCloseTo(box!.width, 0);
				await click(page, card.locator('.course-warning'));
				await expect(card.locator('.course-warning')).toHaveAttribute(
					'aria-expanded',
					'true'
				);
				await expect(card.locator('.course-warning-details')).toBeVisible();
				await expect(card.locator('.course-warning-details')).toContainText(
					courses[cardCode].connections.dependencies[0][0]
				);
				await recording.frame(`course-card-${language}-${theme}-warning-open`);
				await pause(page, 2500);
				await recording.finish(`course-card-${language}-${theme}`);
			} finally {
				await recording.context.close();
			}
		});

		test(`search and plan tutorial ${language} ${theme}`, async ({
			browser,
			baseURL
		}) => {
			const recording = await createRecording(
				browser,
				baseURL!,
				language,
				theme,
				[[], [], []]
			);
			const { page } = recording;
			const steps = tutorialCopy[language]['plan-course'].steps;
			try {
				await page.goto('/app/plan');
				await expect(page.locator('[data-semester="0"]')).toBeVisible();
				await recording.start();
				const search = page.locator('.header-search input');
				await recording.caption(steps[0].title, steps[0].text, search);
				await pause(page, 1500);
				await click(page, search);
				await search.pressSequentially(planCode, {
					delay: process.env.PW_DEMO === 'on' ? 160 : 0
				});
				await search.press('Enter');
				await expect(page).toHaveURL(new RegExp(`/app/search\\?q=${planCode}`));
				const result = page
					.locator(`main a[href="/app/course/${planCode}"]`)
					.first();
				await expect(result.locator('.course-name')).toHaveText(
					courses[planCode].name
				);
				await recording.caption(steps[1].title, steps[1].text, result);
				await recording.frame(`plan-course-${language}-${theme}-search`);
				await pause(page, 3500);
				await click(page, result);
				await expect(page).toHaveURL(new RegExp(`/app/course/${planCode}$`));
				await expect(page.locator('h1.course-name')).toHaveText(
					courses[planCode].name
				);
				const add = page
					.getByTestId('course-plan-actions')
					.getByRole('button', {
						name: language === 'he' ? 'הוספה' : 'Plan',
						exact: true
					});
				await expect(add).toBeEnabled();
				await recording.caption(steps[2].title, steps[2].text, add);
				await pause(page, 3500);
				await click(page, add);
				await expect(
					page.getByTestId('course-plan-actions').getByRole('button', {
						name: language === 'he' ? /הסר מהסמסטר/ : /Remove from semester/
					})
				).toBeVisible();
				await expect
					.poll(() =>
						page.evaluate(
							() => JSON.parse(localStorage.getItem('userData')!).semesters[0]
						)
					)
					.toEqual([planCode]);
				await recording.frame(`plan-course-${language}-${theme}-added`);
				await pause(page, 2000);
				await click(page, page.locator('nav a[href="/app/plan"]'));
				await expect(page).toHaveURL(/\/app\/plan$/);
				const semester = page.locator('[data-semester="0"]');
				await expect(semester.locator(`[data-code="${planCode}"]`)).toHaveCount(
					1
				);
				await expect(semester.locator('.course-name')).toHaveText(
					courses[planCode].name
				);
				await expect(
					page
						.locator('.semester-column--board')
						.first()
						.locator('.semester-points')
				).toContainText(String(courses[planCode].points));
				await recording.caption(
					steps[3].title,
					steps[3].text,
					semester.locator('.course-card')
				);
				await recording.frame(`plan-course-${language}-${theme}-poster`);
				await pause(page, 4000);
				// A reload proves the visible result was durably saved, not just optimistic UI.
				await page.reload();
				await expect(
					page.locator(`[data-semester="0"] [data-code="${planCode}"]`)
				).toHaveCount(1);
				await recording.finish(`plan-course-${language}-${theme}`);
			} finally {
				await recording.context.close();
			}
		});
	}
}
