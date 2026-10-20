import { expect, test, type Page, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mediaVariants, type MediaTopic } from '../src/lib/tutorialMedia';
import { click, createRecording, drag, pause } from './helpers/recording';

const courses = JSON.parse(
	readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
) as Record<
	string,
	{
		name: string;
		points: number;
		tests: { year: number; monthIndex: number; day: number }[];
		connections: { dependencies: string[][] };
	}
>;
const intro = '02340114';
const systems = '02340124';
const organization = '02340118';
const degree: [string, string, string] = [
	'2024_200',
	'00002120',
	'SC00001320_CG00006382'
];
const topics = [
	'feature-plan',
	'feature-catalog',
	'feature-settings',
	'feature-course',
	'feature-semester',
	'feature-share'
] as const satisfies readonly MediaTopic[];
const saved = (page: Page) =>
	page.evaluate(() => JSON.parse(localStorage.getItem('userData')!));

// Expected exam labels come from the checked-in public data, not DOM snapshots.
function examLabels(codes: string[], round: number) {
	const dates = codes
		.map((code) => {
			const tests = courses[code].tests
				.map((t) => Date.UTC(t.year, t.monthIndex, t.day))
				.sort((a, b) => a - b);
			expect(tests.length).toBeGreaterThan(round);
			return tests[round];
		})
		.sort((a, b) => a - b);
	return dates.map((date, index) =>
		index === 0
			? `${new Date(date).getUTCDate()}/${new Date(date).getUTCMonth() + 1}`
			: String((date - dates[index - 1]) / 86400000)
	);
}
async function expectExams(scope: Locator, codes: string[]) {
	await expect(scope.locator('.exam-round')).toHaveCount(2);
	for (const round of [0, 1])
		await expect(
			scope.locator('.exam-round').nth(round).locator('.study-chip')
		).toHaveText(examLabels(codes, round));
}

type Recording = Awaited<ReturnType<typeof createRecording>>;
async function scene(
	recording: Recording,
	language: 'en' | 'he',
	title: [string, string],
	text: [string, string],
	target?: Locator
) {
	await recording.caption(
		title[language === 'he' ? 1 : 0],
		text[language === 'he' ? 1 : 0],
		target
	);
	await pause(recording.page, 3500);
}

for (const topic of topics) {
	for (const { name, language, theme } of mediaVariants(topic)) {
		test(`${topic} recording ${language} ${theme}`, async ({
			browser,
			baseURL
		}) => {
			const semesters =
				topic === 'feature-plan'
					? [[intro, organization], []]
					: topic === 'feature-catalog'
						? [[intro], [systems]]
						: topic === 'feature-settings' || topic === 'feature-course'
							? [[], []]
							: [[intro, organization], [systems]];
			const recording = await createRecording(
				browser,
				baseURL!,
				language,
				theme,
				semesters,
				{
					degree: topic === 'feature-settings' ? null : degree,
					currentSemester: topic === 'feature-catalog' ? 1 : 0,
					wishlist: topic === 'feature-plan' ? [systems] : []
				}
			);
			const { page } = recording;
			const saveName = language === 'he' ? 'שמור' : 'Save';
			try {
				if (topic === 'feature-plan') {
					// Start with a genuinely unplanned wishlist course, not a duplicate.
					await page.goto('/app/plan');
					await expect(
						page.locator('[data-semester="0"] .course-card')
					).toHaveCount(2);
					await recording.start();
					const board = page.locator('.semester-column--board').first();
					await expectExams(board, [intro, organization]);
					await expect(board.locator('.exam-round')).toHaveCount(2);
					await expect(
						board.locator('.exam-round').first().locator('.study-chip')
					).toHaveCount(2);
					await scene(
						recording,
						language,
						['Your semester plan', 'התוכנית שלך'],
						[
							'See courses, credits and both exam rounds together.',
							'רואים קורסים, נקודות זכות ושני מועדי מבחנים יחד.'
						],
						board.locator('.semester-exams')
					);
					await recording.frame(`${name}-exams`);
					const warning = page.locator(
						`[data-semester="0"] [data-code="${organization}"] .course-warning`
					);
					await click(page, warning);
					await expect(warning).toHaveAttribute('aria-expanded', 'true');
					const warningDetails = page.locator(
						`[data-semester="0"] [data-code="${organization}"] .course-warning-details`
					);
					await expect(warningDetails).toContainText(
						courses[organization].connections.dependencies[0][0]
					);
					await scene(
						recording,
						language,
						['Check the requirements', 'בודקים את הדרישות'],
						[
							'Open a warning to see which prerequisites still need planning.',
							'פותחים אזהרה כדי לראות אילו דרישות קדם עדיין חסרות בתכנון.'
						],
						warningDetails
					);
					await recording.frame(`${name}-warning`);
					await click(page, warning);

					const source = page
						.getByTestId('plan-wishlist')
						.locator(`[data-code="${systems}"]`);
					const target = page.locator('[data-semester="1"]');
					await scene(
						recording,
						language,
						['Plan a wish-list course', 'משבצים קורס מרשימת המשאלות'],
						[
							'Drag a saved idea into a semester, then save the change.',
							'גוררים קורס לסמסטר ושומרים את השינוי.'
						],
						source
					);
					await drag(page, source, target);
					await expect(target.locator(`[data-code="${systems}"]`)).toHaveCount(
						1
					);
					await expect(source).toHaveCount(0);
					const save = page.getByRole('button', {
						name: saveName,
						exact: true
					});
					await expect(save).toBeEnabled();
					await click(page, save);
					await expect
						.poll(async () => (await saved(page)).wishlist)
						.toEqual([]);
					await expect
						.poll(async () => (await saved(page)).semesters)
						.toEqual([[intro, organization], [systems]]);
					await scene(
						recording,
						language,
						['Saved for later', 'נשמר להמשך'],
						[
							'The course now belongs to its semester, with updated credit totals.',
							'הקורס משובץ בסמסטר וסכום נקודות הזכות מעודכן.'
						],
						target
					);
					await recording.frame(`${name}-poster`);
				} else if (topic === 'feature-catalog') {
					await page.goto('/app/catalog');
					const summary = page.locator('.catalog-summary');
					await expect(
						summary.locator('.catalog-values').first().locator('dd')
					).toHaveText(['1', '2']);
					await expect(
						summary.locator('.catalog-values').nth(1).locator('dd')
					).toHaveText([
						String(courses[intro].points),
						String(courses[intro].points + courses[systems].points)
					]);
					const before = await saved(page);
					await recording.start();
					await scene(
						recording,
						language,
						['Track degree progress', 'עוקבים אחרי התקדמות בתואר'],
						[
							'Completed courses are before your current semester; planned courses include future semesters.',
							'קורסים לפני הסמסטר הנוכחי נספרים כבוצעו; התכנון כולל גם סמסטרים עתידיים.'
						],
						summary
					);
					await recording.frame(`${name}-poster`);
					const requirement = page
						.locator('.catalog-section')
						.filter({ has: page.locator(`a[href="/app/course/${intro}"]`) })
						.first();
					await expect(requirement.locator('.catalog-metric')).toHaveCount(2);
					await expect(
						requirement.locator('.catalog-values').first().locator('dd')
					).toHaveCount(3);
					await scene(
						recording,
						language,
						['Inspect a requirement', 'בודקים דרישה'],
						[
							'Each group shows completed, planned and total courses, plus credits.',
							'בכל קבוצה רואים בוצע, מתוכנן וסך הכול, בקורסים ובנקודות זכות.'
						],
						requirement.locator('.catalog-progress')
					);
					await recording.frame(`${name}-requirement`);
					const link = requirement
						.locator(`a[href="/app/course/${intro}"]`)
						.first();
					await scene(
						recording,
						language,
						['Explore a course', 'מגלים קורס'],
						[
							'Open a course card to inspect its details.',
							'פותחים כרטיס קורס כדי לבדוק את הפרטים.'
						],
						link
					);
					await click(page, link);
					await expect(page.locator('h1.course-name')).toHaveText(
						courses[intro].name
					);
					expect(await saved(page)).toEqual(before);
					await pause(page, 2500);
				} else if (topic === 'feature-settings') {
					await page.goto('/app/settings');
					const section = page.locator('.degree-section');
					await expect(section.locator('select')).toHaveCount(3);
					await recording.start();
					await scene(
						recording,
						language,
						['Choose your catalog', 'בוחרים קטלוג'],
						[
							'Select your catalog year, faculty and degree.',
							'בוחרים שנת קטלוג, פקולטה ותואר.'
						],
						section
					);
					for (const [index, value] of degree.entries()) {
						const select = section.locator('select').nth(index);
						await moveTo(page, select);
						await select.selectOption(value);
						await expect(select).toHaveValue(value);
						await pause(page, 1400);
					}
					await expect(section.locator('.no-path')).toBeVisible();
					const save = section.getByRole('button', {
						name: saveName,
						exact: true
					});
					await expect(save).toBeEnabled();
					await scene(
						recording,
						language,
						['Save your selection', 'שומרים את הבחירה'],
						[
							'This degree has no extra path to choose. Save to load its catalog.',
							'בתואר הזה אין מסלול נוסף לבחירה. שומרים כדי לטעון את הקטלוג.'
						],
						save
					);
					await click(page, save);
					await expect
						.poll(async () => (await saved(page)).degree)
						.toEqual(degree);
					await expect(save).toHaveCount(0);
					await recording.frame(`${name}-poster`);
					await click(page, page.locator('nav a[href="/app/catalog"]'));
					await expect(page.locator('.catalog-summary')).toBeVisible();
					await expect(
						page.locator('.catalog-section .course-card').first()
					).toBeVisible();
					await scene(
						recording,
						language,
						['Ready to plan', 'מוכנים לתכנן'],
						[
							'Your degree requirements are ready to explore.',
							'דרישות התואר מוכנות לעיון.'
						],
						page.locator('.catalog-summary')
					);
				} else if (topic === 'feature-course') {
					await page.goto(`/app/course/${systems}`);
					await expect(page.locator('h1.course-name')).toHaveText(
						courses[systems].name
					);
					await expect(page.locator('.course-description')).not.toBeEmpty();
					await expect(
						page.locator('.course-header a.course-code')
					).toHaveAttribute('href', new RegExp(`/SM/${systems}$`));
					await expect(
						page.locator('.course-header a.course-code')
					).toHaveAttribute('target', '_blank');

					await recording.start();
					await scene(
						recording,
						language,
						['Understand a course', 'מכירים את הקורס'],
						[
							'Read its description and details before planning it.',
							'קוראים את התיאור והפרטים לפני השיבוץ.'
						],
						page.locator('.course-description')
					);
					const dependencies = page.locator('.course-dependencies');
					await expect(
						dependencies.locator(`a[href="/app/course/${intro}"]`)
					).toHaveCount(1);
					await scene(
						recording,
						language,
						['Check prerequisites', 'בודקים דרישות קדם'],
						[
							'Review the actual prerequisite alternatives shown for this course.',
							'בודקים את חלופות דרישות הקדם שמוצגות לקורס.'
						],
						dependencies
					);
					await recording.frame(`${name}-relationships`);
					const wish = page
						.getByTestId('course-plan-actions')
						.getByRole('button', {
							name: language === 'he' ? 'רשימת משאלות' : 'Wish list',
							exact: true
						});
					await scene(
						recording,
						language,
						['Keep it for later', 'שומרים להמשך'],
						[
							'Add the course to your wish list without placing it in a semester yet.',
							'מוסיפים לרשימת המשאלות בלי לשבץ עדיין בסמסטר.'
						],
						wish
					);
					await click(page, wish);
					await expect
						.poll(async () => (await saved(page)).wishlist)
						.toEqual([systems]);
					await click(page, page.locator('nav a[href="/app/plan"]'));
					const card = page
						.getByTestId('plan-wishlist')
						.locator(`[data-code="${systems}"]`);
					await expect(card.locator('.course-name')).toHaveText(
						courses[systems].name
					);
					await scene(
						recording,
						language,
						['Saved in your wish list', 'נשמר ברשימת המשאלות'],
						[
							'Return whenever you are ready to choose a semester.',
							'חוזרים כשמוכנים לבחור סמסטר.'
						],
						card
					);
					await recording.frame(`${name}-poster`);
				} else if (topic === 'feature-semester') {
					await page.goto('/app/plan');
					await expect(
						page.locator('[data-semester="0"] .course-card')
					).toHaveCount(2);
					const before = await saved(page);
					await recording.start();
					const link = page.locator(
						'a.semester-link[href="/app/semester?c=0"]'
					);
					await scene(
						recording,
						language,
						['Open a semester', 'פותחים סמסטר'],
						[
							'Select its name to explore courses and possible exam schedules.',
							'בוחרים בשם הסמסטר כדי לבדוק קורסים ולוחות מבחנים אפשריים.'
						],
						link
					);
					await click(page, link);
					await expect(page).toHaveURL(/\/app\/semester\?c=0$/);
					const sidebar = page.locator('.semester-sidebar');
					await expectExams(sidebar, [intro, organization]);
					await expect(sidebar.locator('.semester-points')).toContainText(
						String(courses[intro].points + courses[organization].points)
					);
					await expect(
						sidebar.locator('.exam-round').first().locator('.study-chip')
					).toHaveCount(2);
					await expect(
						page.locator('.semester-discovery .course-card:visible').first()
					).toBeVisible();
					await scene(
						recording,
						language,
						['Compare your options', 'משווים אפשרויות'],
						[
							'Temporarily exclude a selected course to compare exam gaps and credits.',
							'מוציאים קורס זמנית מההשוואה כדי לבדוק מרווחי מבחנים ונקודות זכות.'
						],
						sidebar
					);
					const toggle = sidebar.getByRole('button').filter({
						has: page.locator('.course-code', { hasText: organization })
					});
					await click(page, toggle);
					await expect(toggle).toHaveClass(/opacity-50/);
					await expectExams(sidebar, [intro]);
					await expect(sidebar.locator('.semester-points')).toContainText(
						String(courses[intro].points)
					);
					await expect(
						sidebar.locator('.exam-round').first().locator('.study-chip')
					).toHaveCount(1);
					await recording.frame(`${name}-poster`);
					await scene(
						recording,
						language,
						['A comparison, not a deletion', 'השוואה, לא מחיקה'],
						[
							'Turn the course back on. Your saved plan stays unchanged.',
							'מחזירים את הקורס להשוואה. התוכנית השמורה לא משתנה.'
						],
						toggle
					);
					await click(page, toggle);
					await expect(toggle).not.toHaveClass(/opacity-50/);
					await expectExams(sidebar, [intro, organization]);
					await expect(
						sidebar.locator('.exam-round').first().locator('.study-chip')
					).toHaveCount(2);
					expect(await saved(page)).toEqual(before);
					await pause(page, 2500);
				} else {
					// Read the actual donor UI link, then open it in an independent guest
					// context. No authenticated user, synthetic response or private data.
					await page.goto('/app/plan');
					const share = page.locator('a.plan-share');
					await expect(share).toHaveAttribute('target', '_blank');
					const href = await share.getAttribute('href');
					expect(href).toContain('/app/preview/');
					const donorBefore = await saved(page);
					const recipient = await createRecording(
						browser,
						baseURL!,
						language,
						theme,
						[[], []],
						{ currentSemester: 1, wishlist: [intro, '02340141'] }
					);
					try {
						await recipient.page.goto('/app/plan');
						await expect(
							recipient.page.locator('[data-semester="1"]')
						).toBeVisible();
						const recipientBefore = await saved(recipient.page);
						await recipient.page.goto(href!);
						await expect(recipient.page.locator('.preview-course')).toHaveCount(
							3
						);
						await expect(
							recipient.page.locator('.preview-loading')
						).toHaveCount(0);
						expect(await saved(recipient.page)).toEqual(recipientBefore);
						await recipient.start();
						await scene(
							recipient,
							language,
							['A read-only shared plan', 'תוכנית משותפת לצפייה'],
							[
								'The link shows a copy. Viewing it does not change either person’s saved plan.',
								'הקישור מציג עותק. הצפייה לא משנה את התוכנית השמורה של אף צד.'
							],
							recipient.page.locator('.preview-heading')
						);
						await recipient.frame(`${name}-poster`);
						expect(await saved(recipient.page)).toEqual(recipientBefore);
						const copy = recipient.page.locator('.preview-actions button');
						await scene(
							recipient,
							language,
							['Copy into this guest plan', 'מעתיקים לתוכנית האורח'],
							[
								'Copy replaces this guest’s semesters. The chosen current semester stays; only copied courses leave the wish list.',
								'ההעתקה מחליפה את הסמסטרים. הסמסטר הנוכחי נשמר; רק קורסים שהועתקו יוצאים מרשימת המשאלות.'
							],
							copy
						);
						let confirmed = false;
						recipient.page.once('dialog', async (dialog) => {
							expect(dialog.type()).toBe('confirm');
							confirmed = true;
							await dialog.accept();
						});
						await click(recipient.page, copy);
						await expect(recipient.page).toHaveURL(/\/app\/plan$/);
						expect(confirmed).toBe(true);
						await expect
							.poll(async () => (await saved(recipient.page)).semesters)
							.toEqual(semesters);
						const copied = await saved(recipient.page);
						expect(copied.degree).toEqual(degree);
						expect(copied.currentSemester).toBe(1);
						expect(copied.wishlist).toEqual(['02340141']);
						expect(copied.exemptions).toEqual(recipientBefore.exemptions);
						await expect(
							recipient.page.locator('[data-semester="0"] .course-card')
						).toHaveCount(2);
						await expect(
							recipient.page.locator('[data-semester="1"] .course-card')
						).toHaveCount(1);
						await scene(
							recipient,
							language,
							['Your own independent copy', 'עותק עצמאי משלך'],
							[
								'The copied plan is saved here. The original sender’s plan has not changed.',
								'העותק נשמר כאן. התוכנית המקורית של השולח לא השתנתה.'
							],
							recipient.page.locator('[data-semester="1"]')
						);
						await recipient.frame(`${name}-copied`);
						expect(await saved(page)).toEqual(donorBefore);
						await recipient.finish(name);
						const reopened = await recipient.context.newPage();
						await reopened.goto('/app/plan');
						expect(await saved(reopened)).toEqual(copied);
						await expect(
							reopened.locator('[data-semester="1"] .course-card')
						).toHaveCount(1);
					} finally {
						await recipient.context.close();
					}
					return;
				}
				await expect(page.getByTestId('pwa-error-detail')).toHaveCount(0);
				await recording.finish(name);
				if (
					topic === 'feature-plan' ||
					topic === 'feature-settings' ||
					topic === 'feature-course'
				) {
					const reopened = await recording.context.newPage();
					await reopened.goto('/app/plan');
					const persisted = await saved(reopened);
					if (topic === 'feature-plan')
						expect(persisted.semesters).toEqual([
							[intro, organization],
							[systems]
						]);
					if (topic === 'feature-settings')
						expect(persisted.degree).toEqual(degree);
					if (topic === 'feature-course')
						expect(persisted.wishlist).toEqual([systems]);
				}
			} finally {
				await recording.context.close();
			}
		});
	}
}
