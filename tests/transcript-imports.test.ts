import { expect, test, type Page } from '@playwright/test';
import { initializeGuestStorage } from './helpers/student-guest-storage';
import { transcriptPdf } from './helpers/transcript-pdf';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;
const seed = {
	degree: ['2026_200', '00002330', 'SC00001356_CG00011002'],
	semesters: Array.from({ length: 12 }, () => [] as string[]),
	currentSemester: 1,
	exemptions: ['02340114'],
	wishlist: ['02340124']
};
const readPlan = (page: Page) =>
	page.evaluate(() => JSON.parse(localStorage.getItem('userData')!));

for (const language of ['en', 'he'] as const) {
	for (const theme of ['light', 'dark'] as const) {
		test(`${language} ${theme}: transcript failure, retry, cancellation and save preserve intentional guest state`, async ({
			page,
			context
		}, info) => {
			test.setTimeout(90_000);
			await page.setViewportSize({
				width: theme === 'light' ? 390 : 1280,
				height: 844
			});
			await context.route('**/*', (route) =>
				new URL(route.request().url()).origin === origin
					? route.continue()
					: route.abort('blockedbyclient')
			);
			await context.addInitScript(initializeGuestStorage, {
				origin,
				language,
				seed
			});
			await context.addInitScript(
				({ origin, theme }) => {
					if (location.origin === origin) localStorage.setItem('theme', theme);
				},
				{ origin, theme }
			);
			const errors: string[] = [];
			await context.exposeBinding('__transcriptRuntimeError', (_, message) =>
				errors.push(message)
			);
			await context.addInitScript(() => {
				window.addEventListener('unhandledrejection', (event) => {
					void (
						window as unknown as {
							__transcriptRuntimeError: (message: string) => Promise<void>;
						}
					).__transcriptRuntimeError(String(event.reason));
				});
			});
			await page.goto(`${origin}/app/settings`);
			const upload = page.locator('.upload-section');
			const input = upload.locator('input[type=file]');
			const error = upload.getByRole('alert');
			const save = upload.getByRole('button', {
				name: language === 'en' ? 'Save' : 'שמור',
				exact: true
			});
			const cancel = upload.getByRole('button', {
				name: language === 'en' ? 'Cancel' : 'בטל',
				exact: true
			});
			await expect(input).toBeEnabled();
			expect(await readPlan(page)).toEqual(seed);
			await upload.scrollIntoViewIfNeeded();
			await page.screenshot({ path: info.outputPath('before-import.png') });

			const unrelated = {
				name: 'unrelated.pdf',
				mimeType: 'application/pdf',
				buffer: Buffer.from(
					transcriptPdf(['Student information only. No courses.'])
				)
			};
			await input.setInputFiles(unrelated);
			await expect(error).toContainText(
				language === 'en' ? 'No semesters were recognized' : 'לא זוהו סמסטרים'
			);
			await expect(save).toHaveCount(0);
			expect(await readPlan(page)).toEqual(seed);
			// Selecting the exact same rejected file must fire a fresh parse attempt.
			await expect(input).toHaveValue('');
			await input.setInputFiles(unrelated);
			await expect(error).toBeVisible();
			await error.scrollIntoViewIfNeeded();
			await page.screenshot({
				path: info.outputPath('unrecognized-pdf-preserved.png')
			});

			await input.setInputFiles({
				name: 'broken.pdf',
				mimeType: 'application/pdf',
				buffer: Buffer.from('Not a PDF')
			});
			await expect(error).toContainText(
				language === 'en' ? 'could not read this PDF' : 'לא ניתן לקרוא את קובץ'
			);
			await expect(input).toBeEnabled();
			await expect(input).toHaveValue('');
			expect(await readPlan(page)).toEqual(seed);
			expect(errors).toEqual([]);
			await error.scrollIntoViewIfNeeded();
			await page.screenshot({
				path: info.outputPath('invalid-pdf-preserved.png')
			});

			const valid = {
				name: 'fictional-transcript.pdf',
				mimeType: 'application/pdf',
				buffer: Buffer.from(transcriptPdf(['Winter 2025-2026', '02340124']))
			};
			await input.setInputFiles(valid);
			await expect(save).toBeEnabled();
			await expect(error).toHaveCount(0);
			await expect(upload.locator('[data-code="02340124"]')).toBeVisible();
			expect(await readPlan(page)).toEqual(seed);
			await cancel.click();
			await expect(input).toBeEnabled();
			expect(await readPlan(page)).toEqual(seed);
			await input.setInputFiles(valid);
			await expect(save).toBeEnabled();
			await page.screenshot({
				path: info.outputPath('recognized-transcript-preview.png')
			});
			await save.click();
			await expect(page).toHaveURL(`${origin}/app/plan`);
			const expected = {
				...seed,
				semesters: [['02340124'], ...Array.from({ length: 8 }, () => [])],
				currentSemester: 0,
				exemptions: []
			};
			await expect.poll(() => readPlan(page)).toEqual(expected);
			await page.reload();
			await expect(
				page.locator('[data-semester="0"] [data-code="02340124"]')
			).toBeVisible();
			expect(await readPlan(page)).toEqual(expected);
			expect(errors).toEqual([]);
			await page.screenshot({
				path: info.outputPath('saved-valid-transcript.png')
			});
		});
	}
}
