import { expect, test } from '@playwright/test';
import { cms } from '../src/lib/content';

for (const width of [320, 390, 1280]) {
	for (const language of ['en', 'he'] as const) {
		for (const theme of ['light', 'dark'] as const) {
			test(`Search slot preserves copy and plays real ${language}/${theme} media at ${width}px`, async ({
				page
			}) => {
				await page.setViewportSize({ width, height: 900 });
				await page.addInitScript(
					({ language, theme }) => {
						localStorage.setItem('lang', language);
						localStorage.setItem('theme', theme);
					},
					{ language, theme }
				);
				const requests: string[] = [];
				page.on('request', (request) => {
					if (/\.(mp4|webm)(?:\?|$)/.test(request.url()))
						requests.push(request.url());
				});
				await page.goto('/');
				const feature = page.getByTestId('feature-search');
				const section = page.locator('section').filter({ has: feature });
				const copy = cms[language];
				await expect(section.getByRole('heading', { level: 2 })).toHaveText(
					copy.header.searchPlaceholder
				);
				await expect(section.locator('p')).toHaveText(copy.landing.search);
				const sections = page.locator(
					'[data-testid="landing-tutorials"] ~ section'
				);
				await expect(sections.locator('h2')).toHaveText([
					copy.header.plan,
					copy.header.catalog,
					copy.landing.settings.header,
					copy.common.course,
					copy.common.semester,
					copy.landing.share.title,
					copy.header.searchPlaceholder
				]);
				await expect(sections.locator('img')).toHaveCount(6);
				await expect(section).toHaveClass(
					/md:grid-cols-\[minmax\(0,1fr\)_17rem\]/
				);
				const video = feature.locator('video');
				await video.scrollIntoViewIfNeeded();
				await expect(video).toHaveAttribute(
					'poster',
					`/tutorials/feature-search-${language}-${theme}.webp`
				);
				await expect(video).toHaveAttribute('controls', '');
				await expect(video).toHaveAttribute('playsinline', '');
				await expect(video).toHaveAttribute('preload', 'none');
				await expect(video).not.toHaveAttribute('autoplay');
				await expect(video).not.toHaveAttribute('loop');
				await expect(video.locator('track')).toHaveAttribute(
					'srclang',
					language
				);
				await page.waitForTimeout(500);
				expect(requests).toEqual([]);
				await video.focus();
				await expect(video).toBeFocused();
				await video.evaluate(async (node) => (node as HTMLVideoElement).play());
				await expect
					.poll(() =>
						video.evaluate((node) => (node as HTMLVideoElement).currentTime)
					)
					.toBeGreaterThan(1);
				expect(
					await video.evaluate((node) => (node as HTMLVideoElement).currentSrc)
				).toContain(`/tutorials/feature-search-${language}-${theme}.`);
				await video.evaluate((node) => (node as HTMLVideoElement).pause());
				expect(
					await video.evaluate((node) => (node as HTMLVideoElement).paused)
				).toBe(true);
				await video.evaluate((node) => node.requestFullscreen());
				await expect
					.poll(() =>
						video.evaluate((node) => document.fullscreenElement === node)
					)
					.toBe(true);
				await page.evaluate(() => document.exitFullscreen());
				expect(
					await page.evaluate(
						() => document.documentElement.scrollWidth - innerWidth
					)
				).toBeLessThanOrEqual(1);
			});
		}
	}
}

test('Search media resets and actually plays each live language/theme choice', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('lang', 'en');
		localStorage.setItem('theme', 'light');
	});
	await page.goto('/');
	const video = page.getByTestId('feature-search').locator('video');
	for (const [language, theme] of [
		['en', 'light'],
		['he', 'light'],
		['he', 'dark'],
		['en', 'dark']
	] as const) {
		if (language === 'he' && theme === 'light')
			await page
				.getByRole('combobox', { name: 'Language' })
				.selectOption({ label: 'עב' });
		if (language === 'he' && theme === 'dark')
			await page.locator('footer .theme-toggle').click();
		if (language === 'en' && theme === 'dark')
			await page.locator('footer select').selectOption({ label: 'en' });
		await expect(video.locator('source').first()).toHaveAttribute(
			'src',
			`/tutorials/feature-search-${language}-${theme}.mp4`
		);
		expect(
			await video.evaluate((node) => (node as HTMLVideoElement).paused)
		).toBe(true);
		expect(
			await video.evaluate((node) => (node as HTMLVideoElement).currentTime)
		).toBe(0);
		await video.scrollIntoViewIfNeeded();
		await video.evaluate(async (node) => (node as HTMLVideoElement).play());
		await expect
			.poll(() =>
				video.evaluate((node) => (node as HTMLVideoElement).currentTime)
			)
			.toBeGreaterThan(1);
		expect(
			await video.evaluate((node) => (node as HTMLVideoElement).currentSrc)
		).toContain(`/tutorials/feature-search-${language}-${theme}.`);
	}
});

test('Search WebM fallback plays when MP4 is unavailable', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('lang', 'en');
		localStorage.setItem('theme', 'light');
	});
	await page.route('**/tutorials/feature-search-en-light.mp4', (route) =>
		route.fulfill({ status: 503, body: 'Unavailable' })
	);
	await page.goto('/');
	const feature = page.getByTestId('feature-search');
	const video = feature.locator('video');
	await video.scrollIntoViewIfNeeded();
	await video.evaluate(async (node) => (node as HTMLVideoElement).play());
	await expect
		.poll(() =>
			video.evaluate((node) => (node as HTMLVideoElement).currentTime)
		)
		.toBeGreaterThan(1);
	expect(
		await video.evaluate((node) => (node as HTMLVideoElement).currentSrc)
	).toContain('.webm');
	await expect(feature.getByRole('status')).toHaveCount(0);
});

test('Search media failure leaves the existing description available', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.route(/\/tutorials\/feature-search-.*\.(mp4|webm)$/, (route) =>
		route.fulfill({ status: 503, body: 'Unavailable' })
	);
	await page.goto('/');
	const feature = page.getByTestId('feature-search');
	await feature.locator('video').evaluate((node) => {
		const video = node as HTMLVideoElement;
		video.load();
		void video.play().catch(() => {});
	});
	await expect(feature.getByRole('status')).toContainText(
		'The video could not load.'
	);
	await expect(
		page.locator('section').filter({ has: feature }).locator('p').first()
	).toHaveText(cms.en.landing.search);
});
