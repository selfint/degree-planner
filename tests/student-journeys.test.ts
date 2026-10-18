import {
	expect,
	test,
	type BrowserContext,
	type Page,
	type TestInfo
} from '@playwright/test';
import { readFileSync } from 'node:fs';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;
const degree = ['2026_200', '00002330', 'SC00001356_CG00011002'];
const courseCode = '02340124';
const courses = JSON.parse(
	readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
) as Record<string, { faculty: string; points: number }>;
type Language = 'en' | 'he';
type GuestPlan = {
	degree?: string[];
	path?: string;
	exemptions: string[];
	semesters: string[][];
	currentSemester: number;
	wishlist: string[];
};
const labels = {
	en: {
		year: 'Year',
		faculty: 'Faculty',
		degree: 'Degree',
		selectYear: 'Select year',
		save: 'Save',
		cancel: 'Cancel',
		current: 'Current',
		total: 'Total',
		plan: 'Plan',
		wish: 'Wish list',
		remove: 'Remove from semester',
		share: 'Share',
		copy: 'Copy plan',
		requirements: 'Course requirement details'
	},
	he: {
		year: 'שנה',
		faculty: 'פקולטה',
		degree: 'תואר',
		selectYear: 'בחר שנה',
		save: 'שמור',
		cancel: 'בטל',
		current: 'נוכחי',
		total: 'סה"כ',
		plan: 'הוספה',
		wish: 'רשימת משאלות',
		remove: 'הסר מהסמסטר',
		share: 'שתף',
		copy: 'העתק תוכנית',
		requirements: 'פרטי דרישות הקורס'
	}
} as const;

// These are bounded functional journeys against the checked-in public catalog.
// Fresh browser contexts and a same-origin network allowlist prevent any real
// authentication, Firestore, SAP, analytics or external user-plan traffic.
async function isolateGuest(
	context: BrowserContext,
	language: Language,
	seed?: GuestPlan
) {
	await context.route('**/*', async (route) => {
		if (new URL(route.request().url()).origin === origin)
			await route.continue();
		else await route.abort('blockedbyclient');
	});
	await context.addInitScript(
		({ language, seed }) => {
			// Do not reseed on reload: persistence and preference changes are part
			// of the journey, and a repeating fixture would conceal data loss.
			if (localStorage.getItem('student-journey-initialized') !== null) return;
			localStorage.setItem('student-journey-initialized', 'true');
			localStorage.setItem('lang', language);
			if (seed) {
				localStorage.setItem('version', '4');
				localStorage.setItem('userData', JSON.stringify(seed));
			}
		},
		{ language, seed }
	);
}

async function readPlan(page: Page): Promise<GuestPlan> {
	return page.evaluate(() => JSON.parse(localStorage.getItem('userData')!));
}

async function openSettings(page: Page) {
	await page.goto(`${origin}/app/settings`);
	await expect(page.locator('.degree-section')).toBeVisible();
	await expect(page.locator('#console-boot')).toBeHidden();
}

async function chooseDegree(page: Page, language: Language) {
	const text = labels[language];
	const section = page.locator('.degree-section');
	await section
		.getByRole('combobox', { name: text.year, exact: true })
		.selectOption(degree[0]);
	await section
		.getByRole('combobox', { name: text.faculty, exact: true })
		.selectOption(degree[1]);
	await section
		.getByRole('combobox', { name: text.degree, exact: true })
		.selectOption(degree[2]);
	await section.getByRole('button', { name: text.save, exact: true }).click();
	await expect.poll(async () => (await readPlan(page)).degree).toEqual(degree);
	await expect(
		section.getByRole('button', { name: text.save, exact: true })
	).toHaveCount(0);
}

async function saveSemesterSetting(
	page: Page,
	language: Language,
	setting: 'current' | 'total',
	value: number
) {
	const text = labels[language];
	const field = page.locator('.semester-field').filter({
		has: page.getByRole('combobox', { name: text[setting], exact: true })
	});
	await field.getByRole('combobox').selectOption(String(value));
	await field.getByRole('button', { name: text.save, exact: true }).click();
	await expect
		.poll(async () => {
			const plan = await readPlan(page);
			return setting === 'current'
				? plan.currentSemester
				: plan.semesters.length;
		})
		.toBe(value);
}

async function capture(page: Page, info: TestInfo, name: string) {
	// Preserve the real viewport and RTL rail positions. Full-page screenshots
	// can temporarily resize/scroll the document and change the state under test.
	const path = info.outputPath(`${name}.png`);
	await page.screenshot({ path });
	await info.attach(name, { path, contentType: 'image/png' });
}

test.use({ serviceWorkers: 'block', trace: 'on' });

for (const language of ['en', 'he'] as const) {
	test(`${language}: a fresh student recovers interrupted degree setup and reopens a saved course`, async ({
		page,
		context
	}, info) => {
		test.setTimeout(90_000);
		await isolateGuest(context, language);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const text = labels[language];
		await openSettings(page);
		const original = await readPlan(page);
		expect(original.degree).toBeUndefined();
		const section = page.locator('.degree-section');

		await test.step('Cancel and navigation interruption cannot save a partial degree', async () => {
			await section
				.getByRole('combobox', { name: text.year, exact: true })
				.selectOption(degree[0]);
			await expect(
				section.getByRole('button', { name: text.save, exact: true })
			).toBeDisabled();
			await section
				.getByRole('button', { name: text.cancel, exact: true })
				.click();
			await expect(
				section
					.getByRole('combobox', { name: text.year, exact: true })
					.locator('option:checked')
			).toHaveText(text.selectYear);
			expect(await readPlan(page)).toEqual(original);
			await section
				.getByRole('combobox', { name: text.year, exact: true })
				.selectOption(degree[0]);
			await section
				.getByRole('combobox', { name: text.faculty, exact: true })
				.selectOption(degree[1]);
			const search = page.getByRole('search').getByRole('textbox');
			await search.fill(courseCode);
			await search.press('Enter');
			await expect(page).toHaveURL(
				new RegExp(`/app/search\\?q=${courseCode}$`)
			);
			await page.goBack();
			await expect(page.locator('.degree-section')).toBeVisible();
			await expect(
				section
					.getByRole('combobox', { name: text.year, exact: true })
					.locator('option:checked')
			).toHaveText(text.selectYear);
			expect(await readPlan(page)).toEqual(original);
		});

		await chooseDegree(page, language);
		await saveSemesterSetting(page, language, 'total', 3);
		await saveSemesterSetting(page, language, 'current', 1);
		await test.step('Search, combine a real faculty filter, wish, then plan the course', async () => {
			const search = page.getByRole('search').getByRole('textbox');
			await search.fill(courseCode);
			await search.press('Enter');
			await page
				.locator('#search-faculty')
				.selectOption(courses[courseCode].faculty);
			await expect(page.locator('main ul > li')).toHaveCount(1);
			await page
				.locator(`main li[id="${courseCode}"]`)
				.getByRole('button')
				.click();
			const actions = page.getByTestId('course-plan-actions');
			await actions
				.getByRole('button', { name: text.wish, exact: true })
				.click();
			await expect
				.poll(async () => (await readPlan(page)).wishlist)
				.toEqual([courseCode]);
			await page.reload();
			await actions
				.getByRole('button', { name: text.plan, exact: true })
				.click();
			await expect(
				actions.getByRole('button', { name: new RegExp(`^${text.remove}`) })
			).toBeVisible();
			await expect
				.poll(() => readPlan(page))
				.toEqual({
					degree,
					exemptions: [],
					semesters: [[], [courseCode], []],
					currentSemester: 1,
					wishlist: []
				});
		});

		const saved = await readPlan(page);
		await page.locator('header nav a[href="/app/plan"]').click();
		await expect(
			page.locator(`[data-semester="1"] [data-code="${courseCode}"]`)
		).toBeVisible();
		await capture(page, info, 'saved-student-plan');
		await test.step('Theme, language, resize, and a new tab preserve the saved plan', async () => {
			await page.locator('footer button[aria-pressed]').click();
			await page
				.locator('footer')
				.getByRole('combobox')
				.selectOption({ label: language === 'en' ? 'עב' : 'en' });
			await page.setViewportSize({ width: 320, height: 740 });
			expect(await readPlan(page)).toEqual(saved);
			await capture(page, info, 'saved-student-plan-narrow-other-language');
			const reopened = await context.newPage();
			await reopened.goto(`${origin}/app/plan`);
			await expect(
				reopened.locator(`[data-semester="1"] [data-code="${courseCode}"]`)
			).toBeVisible();
			expect(await readPlan(reopened)).toEqual(saved);
			await expect(reopened.locator('html')).toHaveAttribute(
				'data-theme',
				'light'
			);
			await reopened.close();
		});
		expect(errors).toEqual([]);
	});

	test(`${language}: a generated share link imports into an independent guest without changing its owner`, async ({
		page,
		context,
		browser
	}, info) => {
		test.setTimeout(90_000);
		const text = labels[language];
		const owner: GuestPlan = {
			degree,
			exemptions: ['03240033'],
			semesters: [[courseCode], [], ['02340141']],
			currentSemester: 2,
			wishlist: ['01040184']
		};
		await isolateGuest(context, language, owner);
		await page.goto(`${origin}/app/plan`);
		const share = page.getByRole('link', { name: text.share, exact: true });
		await expect(share).toBeVisible();
		const popupPromise = page.waitForEvent('popup');
		await share.click();
		const preview = await popupPromise;
		await expect(preview.locator('.preview-semester')).toHaveCount(3);
		const shareUrl = preview.url();
		expect(new URL(shareUrl).searchParams.get('semesters')).toBe(
			`${courseCode}~~02340141`
		);
		expect(await readPlan(page)).toEqual(owner);
		await capture(preview, info, 'generated-share-preview');

		const recipient = await browser.newContext({
			viewport: page.viewportSize(),
			serviceWorkers: 'block'
		});
		// Playwright Test automatically traces every context created through its
		// browser fixture. Starting another trace here would throw before import.
		let journeyFailed = false;
		try {
			await isolateGuest(recipient, language);
			const copy = await recipient.newPage();
			await copy.goto(shareUrl);
			await expect(copy.locator('.preview-semester')).toHaveCount(3);
			const initial = await readPlan(copy);
			const importButton = copy.getByRole('button', {
				name: text.copy,
				exact: true
			});
			copy.once('dialog', (dialog) => dialog.dismiss());
			await importButton.click();
			await expect(copy).toHaveURL(shareUrl);
			expect(await readPlan(copy)).toEqual(initial);
			copy.once('dialog', (dialog) => dialog.accept());
			await importButton.click();
			await expect(copy).toHaveURL(`${origin}/app/plan`);
			await expect
				.poll(() => readPlan(copy))
				.toEqual({
					degree,
					exemptions: [],
					semesters: owner.semesters,
					currentSemester: 0,
					wishlist: []
				});
			await copy.reload();
			await expect(
				copy.locator(`[data-semester="2"] [data-code="02340141"]`)
			).toBeVisible();
			await capture(copy, info, 'independent-imported-plan');
			const imported = await readPlan(copy);
			const card = copy.locator(
				`[data-semester="0"] [data-code="${courseCode}"]`
			);
			const requirementDetails = card.getByRole('button', {
				name: text.requirements,
				exact: true
			});
			await expect(requirementDetails).toHaveAttribute(
				'aria-expanded',
				'false'
			);
			// A planned course with unmet prerequisites first reveals its warnings.
			// A second normal click opens the details; neither click edits the plan.
			await card.locator('.course-open').click();
			await expect(requirementDetails).toHaveAttribute('aria-expanded', 'true');
			await expect(card.locator('.course-warning-details')).toBeVisible();
			await expect(copy).toHaveURL(`${origin}/app/plan`);
			expect(await readPlan(copy)).toEqual(imported);
			await capture(copy, info, 'imported-course-requirements-expanded');
			await card.locator('.course-open').click();
			await expect(copy).toHaveURL(`${origin}/app/course/${courseCode}`);
			expect(await readPlan(copy)).toEqual(imported);
			await copy
				.getByTestId('course-plan-actions')
				.getByRole('button', { name: new RegExp(`^${text.remove}`) })
				.click();
			await expect
				.poll(async () => (await readPlan(copy)).semesters)
				.toEqual([[], [], ['02340141']]);
			expect(await readPlan(page)).toEqual(owner);
			await page.reload();
			await expect(
				page.locator(`[data-semester="0"] [data-code="${courseCode}"]`)
			).toBeVisible();
			expect(await readPlan(page)).toEqual(owner);
		} catch (error) {
			journeyFailed = true;
			throw error;
		} finally {
			// Keep the original journey error if timeout teardown already closed a
			// context. Cleanup errors still fail an otherwise successful journey.
			const cleanup = await Promise.allSettled([
				recipient.close(),
				preview.close()
			]);
			if (!journeyFailed) {
				const failure = cleanup.find((result) => result.status === 'rejected');
				if (failure?.status === 'rejected') throw failure.reason;
			}
		}
	});

	test(`${language}: a returning student must choose an in-range Current before importing a shorter plan`, async ({
		page,
		context
	}, info) => {
		const text = labels[language];
		const guest: GuestPlan = {
			degree,
			exemptions: ['03240033'],
			semesters: [['01040184'], [], [], []],
			currentSemester: 3,
			wishlist: [courseCode, '02340141']
		};
		await isolateGuest(context, language, guest);
		const shareUrl = `${origin}/app/preview/${degree.join('/')}?semesters=${courseCode}~`;
		await page.goto(shareUrl);
		const copy = page.getByRole('button', { name: text.copy, exact: true });
		let dialogs = 0;
		const dismissUnexpected = async (
			dialog: import('@playwright/test').Dialog
		) => {
			dialogs++;
			await dialog.dismiss();
		};
		page.on('dialog', dismissUnexpected);
		await copy.click();
		const error = page.getByTestId('preview-import-error');
		await expect(error).toBeVisible();
		expect(dialogs).toBe(0);
		expect(await readPlan(page)).toEqual(guest);
		await capture(page, info, 'short-share-import-rejected-with-plan-intact');
		page.off('dialog', dismissUnexpected);
		await error.getByRole('link').click();
		await expect(page).toHaveURL(`${origin}/app/settings`);
		await saveSemesterSetting(page, language, 'current', 1);
		expect(await readPlan(page)).toEqual({ ...guest, currentSemester: 1 });
		await page.goBack();
		await expect(page).toHaveURL(shareUrl);
		page.once('dialog', (dialog) => dialog.dismiss());
		await copy.click();
		expect(await readPlan(page)).toEqual({ ...guest, currentSemester: 1 });
		page.once('dialog', (dialog) => dialog.accept());
		await copy.click();
		await expect(page).toHaveURL(`${origin}/app/plan`);
		const imported = {
			...guest,
			currentSemester: 1,
			semesters: [[courseCode], []],
			wishlist: ['02340141']
		};
		await expect.poll(() => readPlan(page)).toEqual(imported);
		await page.reload();
		await expect(
			page.locator(`[data-semester="0"] [data-code="${courseCode}"]`)
		).toBeVisible();
		expect(await readPlan(page)).toEqual(imported);
		await capture(
			page,
			info,
			'short-share-import-after-explicit-current-choice'
		);
	});

	test(`${language}: shortening the plan cannot remove its selected current semester`, async ({
		page,
		context
	}, info) => {
		const guest: GuestPlan = {
			degree,
			exemptions: [],
			semesters: [[courseCode], [], [], []],
			currentSemester: 3,
			wishlist: ['02340141']
		};
		await isolateGuest(context, language, guest);
		await openSettings(page);
		const total = page.getByRole('combobox', {
			name: labels[language].total,
			exact: true
		});
		await expect(
			page.getByRole('combobox', {
				name: labels[language].current,
				exact: true
			})
		).toHaveValue('3');
		await capture(page, info, 'current-semester-truncation-options');
		// A chosen current semester is user intent. Require an explicit change to
		// Current before shortening past it; do not silently clamp or discard it.
		const offered = await total
			.locator('option:not([disabled])')
			.evaluateAll((options) =>
				options.map((option) => Number((option as HTMLOptionElement).value))
			);
		expect(offered.every((count) => count > guest.currentSemester)).toBe(true);
		expect(await readPlan(page)).toEqual(guest);
		await saveSemesterSetting(page, language, 'current', 0);
		await saveSemesterSetting(page, language, 'total', 2);
		await page.reload();
		await expect(
			page.getByRole('combobox', {
				name: labels[language].current,
				exact: true
			})
		).toHaveValue('0');
		await expect
			.poll(() => readPlan(page))
			.toEqual({ ...guest, currentSemester: 0, semesters: [[courseCode], []] });
	});
}
