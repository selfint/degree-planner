import { expect, test } from '@playwright/test';
import { journeyTitles, type JourneyTopic } from '../../src/lib/journeyMedia';
const stories: Record<JourneyTopic, string> = {
	'setup-recovery': 'recover-setup-and-reopen',
	'independent-share': 'share-with-independent-guest',
	'shorter-import': 'choose-current-before-import',
	'safe-shortening': 'safely-shorten-plan'
};
const url = (topic: JourneyTopic, language = 'en', theme = 'dark') =>
	`/storybook/iframe.html?id=user-flows-student-journeys--${stories[topic]}&viewMode=story&globals=language:${language};theme:${theme};direction:auto`;
for (const topic of Object.keys(stories) as JourneyTopic[])
	for (const language of ['en', 'he'] as const)
		for (const theme of ['light', 'dark'] as const) {
			test(`journey ${topic} plays real ${language}/${theme} media and fits narrow canvas`, async ({
				page
			}) => {
				const requests: string[] = [];
				page.on('request', (r) => {
					if (/\.(mp4|webm)(?:\?|$)/.test(r.url())) requests.push(r.url());
				});
				await page.setViewportSize({ width: 320, height: 900 });
				await page.goto(url(topic, language, theme));
				await expect(page.getByRole('heading', { level: 1 })).toHaveText(
					journeyTitles[topic][language]
				);
				const video = page
					.getByTestId('student-journey-video')
					.locator('video');
				await expect(video).toBeVisible();
				await video.scrollIntoViewIfNeeded();
				await expect(video).toHaveAttribute(
					'poster',
					`/tutorials/journeys/${topic}-${language}-${theme}.webp`
				);
				await expect(video).toHaveAttribute('controls', '');
				await expect(video).toHaveAttribute('preload', 'none');
				await expect(video).toHaveAttribute('playsinline', '');
				await expect(video).not.toHaveAttribute('autoplay');
				await expect(video).not.toHaveAttribute('loop');
				await expect(video.locator('track')).toHaveAttribute(
					'srclang',
					language
				);
				await expect(video.locator('track')).toHaveAttribute(
					'label',
					language === 'he' ? 'תיאורים בעברית' : 'English descriptions'
				);
				await page.waitForTimeout(250);
				expect(requests).toEqual([]);
				await video.focus();
				await expect(video).toBeFocused();
				await video.evaluate(async (n) => (n as HTMLVideoElement).play());
				await expect
					.poll(() =>
						video.evaluate((n) => (n as HTMLVideoElement).currentTime)
					)
					.toBeGreaterThan(1);
				expect(
					await video.evaluate((n) => (n as HTMLVideoElement).currentSrc)
				).toContain(`/tutorials/journeys/${topic}-${language}-${theme}.`);
				await video.evaluate((n) => (n as HTMLVideoElement).pause());
				expect(
					await video.evaluate((n) => (n as HTMLVideoElement).paused)
				).toBe(true);
				expect(
					await page.evaluate(
						() => document.documentElement.scrollWidth - innerWidth
					)
				).toBeLessThanOrEqual(1);
				await page.setViewportSize({ width: 1280, height: 900 });
				expect((await video.boundingBox())!.width).toBeLessThanOrEqual(896);
			});
		}
test('journey player resets and plays actual media after live Storybook toolbar changes', async ({
	page
}) => {
	await page.goto(url('independent-share'));
	const video = page.getByTestId('student-journey-video').locator('video');
	for (const [language, theme] of [
		['en', 'dark'],
		['he', 'dark'],
		['he', 'light'],
		['en', 'light']
	] as const) {
		await page.evaluate(
			({ language, theme }) => {
				(
					window as Window & {
						__STORYBOOK_ADDONS_CHANNEL__: {
							emit: (name: string, value: unknown) => void;
						};
					}
				).__STORYBOOK_ADDONS_CHANNEL__.emit('updateGlobals', {
					globals: { language, theme, direction: 'auto' }
				});
			},
			{ language, theme }
		);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(
			journeyTitles['independent-share'][language]
		);
		await expect(video.locator('track')).toHaveAttribute('srclang', language);
		await expect(video.locator('source').first()).toHaveAttribute(
			'src',
			`/tutorials/journeys/independent-share-${language}-${theme}.mp4`
		);
		expect(await video.evaluate((n) => (n as HTMLVideoElement).paused)).toBe(
			true
		);
		expect(
			await video.evaluate((n) => (n as HTMLVideoElement).currentTime)
		).toBe(0);
		await video.evaluate(async (n) => (n as HTMLVideoElement).play());
		await expect
			.poll(() => video.evaluate((n) => (n as HTMLVideoElement).currentTime))
			.toBeGreaterThan(1);
	}
});
test('journey WebM fallback plays and native fullscreen is available', async ({
	page
}) => {
	await page.route(
		'**/tutorials/journeys/safe-shortening-en-dark.mp4',
		(route) => route.fulfill({ status: 503, body: 'Unavailable' })
	);
	await page.goto(url('safe-shortening'));
	const video = page.locator('video');
	await video.evaluate(async (n) => (n as HTMLVideoElement).play());
	await expect
		.poll(() => video.evaluate((n) => (n as HTMLVideoElement).currentTime))
		.toBeGreaterThan(1);
	expect(
		await video.evaluate((n) => (n as HTMLVideoElement).currentSrc)
	).toContain('.webm');
	await video.evaluate((n) => n.requestFullscreen());
	await expect
		.poll(() => video.evaluate((n) => document.fullscreenElement === n))
		.toBe(true);
	await page.evaluate(() => document.exitFullscreen());
});
