import { expect, test } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

for (const width of [320, 390, 1280]) {
	for (const language of ['en', 'he']) {
		for (const theme of ['light', 'dark']) {
			test(`landing tutorials ${language} ${theme} ${width}`, async ({
				page
			}, info) => {
				await page.setViewportSize({ width, height: 900 });
				await page.emulateMedia({ reducedMotion: 'reduce' });
				await page.addInitScript(
					({ language, theme }) => {
						localStorage.setItem('lang', language);
						localStorage.setItem('theme', theme);
					},
					{ language, theme }
				);
				const mediaRequests: string[] = [];
				const consoleRequests: string[] = [];
				page.on('request', (request) => {
					const pathname = new URL(request.url()).pathname;
					if (/\.(webm|mp4)$/.test(pathname)) mediaRequests.push(pathname);
					if (
						/\/app(?:\/|$)|\/(courseData|catalogs).*json$|service-worker\.js/.test(
							pathname
						)
					)
						consoleRequests.push(pathname);
				});
				await page.goto(baseURL);
				await expect(page.locator('#landing-title')).toBeVisible();
				const tutorials = page.getByTestId('landing-tutorials');
				await expect(tutorials).toBeVisible();
				await expect(tutorials).toHaveAttribute(
					'dir',
					language === 'he' ? 'rtl' : 'ltr'
				);
				await expect(tutorials.locator('video')).toHaveCount(2);
				for (const topic of ['course-card', 'plan-course']) {
					const tutorial = tutorials.getByTestId(`tutorial-${topic}`);
					const video = tutorial.locator('video');
					await expect(video).toHaveAttribute('preload', 'none');
					await expect(video).toHaveAttribute('controls', '');
					await expect(video).toHaveAttribute('playsinline', '');
					await expect(video).not.toHaveAttribute('autoplay');
					await expect(video).not.toHaveAttribute('loop');
					await expect(video).toHaveAttribute(
						'poster',
						`/tutorials/${topic}-${language}-${theme}.webp`
					);
					await expect(
						video.locator('source[type="video/mp4"]')
					).toHaveAttribute(
						'src',
						`/tutorials/${topic}-${language}-${theme}.mp4`
					);
					await expect(video.locator('track')).toHaveAttribute(
						'srclang',
						language
					);
					await expect(tutorial.locator('details, summary')).toHaveCount(0);
					await expect(tutorial.locator('.tutorial-steps li')).toHaveCount(
						topic === 'course-card' ? 6 : 4
					);
					await video.scrollIntoViewIfNeeded();
					expect(
						await video.evaluate((v) => (v as HTMLVideoElement).paused)
					).toBe(true);
					await page.screenshot({
						path: info.outputPath(`${topic}-${language}-${theme}-${width}.png`)
					});
				}
				await page.waitForTimeout(1800);
				expect(
					mediaRequests,
					'no video bytes before deliberate playback'
				).toEqual([]);
				expect(
					consoleRequests,
					'landing does not boot the planner or load private/public course data'
				).toEqual([]);
				expect(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth
					)
				).toBe(true);
				const video = tutorials.locator('video').first();
				await video.focus();
				await expect(video).toBeFocused();
			});
		}
	}
}

test('tutorial media plays, pauses, and exposes readable failure guidance', async ({
	page
}) => {
	await page.goto(baseURL);
	const tutorial = page.getByTestId('tutorial-course-card');
	const video = tutorial.locator('video');
	await video.evaluate(async (node) => {
		await (node as HTMLVideoElement).play();
	});
	await expect
		.poll(() =>
			video.evaluate((node) => (node as HTMLVideoElement).currentTime)
		)
		.toBeGreaterThan(0);
	await video.evaluate((node) => (node as HTMLVideoElement).pause());
	expect(
		await video.evaluate((node) => (node as HTMLVideoElement).paused)
	).toBe(true);
	await video.dispatchEvent('error');
	await expect(tutorial.getByRole('status')).toBeVisible();
	await expect(tutorial.locator('.tutorial-steps li')).toHaveCount(6);
});
