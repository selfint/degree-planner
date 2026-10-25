import { expect, test } from '@playwright/test';
import { mediaGroups } from '../src/lib/tutorialMedia';
import { writeFile } from 'node:fs/promises';

// Seven feature slots are exercised instead of the removed two-tutorial panel.
test.setTimeout(120_000);

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

for (const width of [320, 390, 1280]) {
	for (const language of ['en', 'he']) {
		for (const theme of ['light', 'dark']) {
			test(`landing feature videos ${language} ${theme} ${width}`, async ({
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
				const loadedPosters = new Set<string>();
				page.on('response', (response) => {
					const pathname = new URL(response.url()).pathname;
					if (
						pathname.startsWith('/tutorials/') &&
						pathname.endsWith('.webp') &&
						response.ok()
					)
						loadedPosters.add(pathname);
				});
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
				await expect(page.locator('.landing h1')).toBeVisible();
				const tutorials = page.locator('.landing');
				await expect(tutorials).toBeVisible();
				await expect(tutorials).toHaveAttribute(
					'dir',
					language === 'he' ? 'rtl' : 'ltr'
				);
				await expect(tutorials.locator('video')).toHaveCount(7);
				for (const topic of mediaGroups.features) {
					const tutorial = tutorials.getByTestId(topic);
					const video = tutorial.locator('video');
					await expect(video).toHaveAttribute('preload', 'none');
					const frame = await video.boundingBox();
					expect(frame!.width / frame!.height).toBeCloseTo(4 / 3, 2);
					await expect(video).toHaveAttribute('controls', '');
					await expect(video).toHaveAttribute('playsinline', '');
					await expect(video).not.toHaveAttribute('autoplay');
					await expect(video).not.toHaveAttribute('loop');
					await video.scrollIntoViewIfNeeded();
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
					await expect(
						tutorial.locator('xpath=ancestor::section').locator('p').first()
					).toBeVisible();
					await video.scrollIntoViewIfNeeded();
					expect(
						await video.evaluate((v) => (v as HTMLVideoElement).paused)
					).toBe(true);
					await expect
						.poll(() =>
							loadedPosters.has(`/tutorials/${topic}-${language}-${theme}.webp`)
						)
						.toBe(true);
					// Capture the settled poster, rather than its native image-loading animation.
					await page.waitForTimeout(2000);
					const idle = await video.evaluate((node) => {
						const player = node as HTMLVideoElement;
						return {
							paused: player.paused,
							currentTime: player.currentTime,
							readyState: player.readyState,
							networkState: player.networkState,
							currentSrc: player.currentSrc,
							poster: player.poster
						};
					});
					await writeFile(
						info.outputPath(`${topic}-${language}-${theme}-${width}-idle.json`),
						JSON.stringify(idle, null, 2)
					);
					expect(idle.paused).toBe(true);
					expect(idle.currentTime).toBe(0);
					expect(
						idle.networkState,
						'idle poster must not leave native media loading indefinitely'
					).not.toBe(2);
					await tutorial.screenshot({
						path: info.outputPath(
							`${topic}-${language}-${theme}-${width}-section.png`
						)
					});
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

for (const { language, theme, width } of [
	{ language: 'he', theme: 'dark', width: 320 },
	{ language: 'en', theme: 'light', width: 390 },
	{ language: 'en', theme: 'dark', width: 1280 },
	{ language: 'he', theme: 'light', width: 1280 }
]) {
	test(`tutorial media plays and pauses ${language} ${theme} ${width}`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.addInitScript(
			({ language, theme }) => {
				localStorage.setItem('lang', language);
				localStorage.setItem('theme', theme);
			},
			{ language, theme }
		);
		await page.goto(baseURL);
		for (const topic of mediaGroups.features) {
			const tutorial = page.getByTestId(topic);
			const video = tutorial.locator('video');
			await expect(video.locator('source').first()).toHaveAttribute(
				'src',
				`/tutorials/${topic}-${language}-${theme}.mp4`
			);
			await video.scrollIntoViewIfNeeded();
			await video.evaluate(async (node) => {
				await (node as HTMLVideoElement).play();
			});
			await expect
				.poll(() =>
					video.evaluate((node) => (node as HTMLVideoElement).currentTime)
				)
				.toBeGreaterThan(3);
			expect(
				await video.evaluate((node) => (node as HTMLVideoElement).currentSrc)
			).toContain(`/tutorials/${topic}-${language}-${theme}.`);
			await video.evaluate((node) => (node as HTMLVideoElement).pause());
			expect(
				await video.evaluate((node) => (node as HTMLVideoElement).paused)
			).toBe(true);
			await page.screenshot({
				path: info.outputPath(
					`${topic}-playing-${language}-${theme}-${width}.png`
				)
			});
			await video.evaluate(async (node) => {
				await node.requestFullscreen();
			});
			await expect
				.poll(() =>
					video.evaluate((node) => document.fullscreenElement === node)
				)
				.toBe(true);
			if (width < 500)
				await page.setViewportSize({ width: 900, height: width });
			await video.evaluate(async (node) => (node as HTMLVideoElement).play());
			await expect
				.poll(() =>
					video.evaluate((node) => (node as HTMLVideoElement).currentTime)
				)
				.toBeGreaterThan(6);
			await page.screenshot({
				path: info.outputPath(
					`${topic}-fullscreen-${language}-${theme}-${width}.png`
				)
			});
			await video.evaluate((node) => (node as HTMLVideoElement).pause());
			await page.evaluate(() => document.exitFullscreen());
			if (width < 500) await page.setViewportSize({ width, height: 900 });
			await video.dispatchEvent('error');
			await expect(tutorial.getByRole('status')).toBeVisible();
			await expect(
				tutorial.locator('xpath=ancestor::section').locator('p').first()
			).toBeVisible();
		}
	});
}

test('both unavailable media sources expose a real failure message and readable steps', async ({
	page
}, info) => {
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	const failedSources = new Set<string>();
	await page.route(
		/\/tutorials\/feature-course-en-.*\.(mp4|webm)$/,
		async (route) => {
			failedSources.add(new URL(route.request().url()).pathname);
			await route.fulfill({
				status: 503,
				contentType: 'text/plain',
				body: 'Media unavailable for this test'
			});
		}
	);
	await page.goto(baseURL);
	const tutorial = page.getByTestId('feature-course');
	const video = tutorial.locator('video');
	await expect(video.locator('source').first()).toHaveAttribute(
		'src',
		/\/feature-course-en-.*\.mp4$/
	);
	await video.scrollIntoViewIfNeeded();
	await video.evaluate((node) => {
		const player = node as HTMLVideoElement;
		player.load();
		void player.play().catch(() => {});
	});
	await expect
		.poll(() => failedSources.size, 'both actual formats failed to load')
		.toBe(2);
	await expect(tutorial.getByRole('status')).toContainText(
		'The video could not load.'
	);
	await expect(
		tutorial.locator('xpath=ancestor::section').locator('p').first()
	).toBeVisible();
	await page.screenshot({ path: info.outputPath('real-media-failure.png') });
});

test('live language and theme preferences replace media without autoplay', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('lang', 'en');
		localStorage.setItem('theme', 'light');
	});
	await page.goto(baseURL);
	const tutorial = page.getByTestId('feature-course');
	const video = tutorial.locator('video');
	await video.scrollIntoViewIfNeeded();
	await video.evaluate(async (node) => (node as HTMLVideoElement).play());
	await expect
		.poll(() =>
			video.evaluate((node) => (node as HTMLVideoElement).currentTime)
		)
		.toBeGreaterThan(0);
	await page
		.getByRole('combobox', { name: 'Language' })
		.selectOption({ label: 'עב' });
	await expect(page.locator('.landing')).toHaveAttribute('dir', 'rtl');
	await expect(video.locator('source').first()).toHaveAttribute(
		'src',
		'/tutorials/feature-course-he-light.mp4'
	);
	expect(
		await video.evaluate((node) => (node as HTMLVideoElement).paused)
	).toBe(true);
	await page.locator('footer .theme-toggle').click();
	await expect(video.locator('source').first()).toHaveAttribute(
		'src',
		'/tutorials/feature-course-he-dark.mp4'
	);
	await expect(video.locator('track')).toHaveAttribute('srclang', 'he');
	expect(
		await video.evaluate((node) => (node as HTMLVideoElement).paused)
	).toBe(true);
	expect(
		await video.evaluate((node) => (node as HTMLVideoElement).currentTime)
	).toBe(0);
});

test('the WebM fallback remains playable when MP4 fails', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	let mp4Failed = false;
	await page.route(/\/tutorials\/feature-course-en-.*\.mp4$/, async (route) => {
		mp4Failed = true;
		await route.fulfill({ status: 503, body: 'MP4 unavailable for this test' });
	});
	await page.goto(baseURL);
	const tutorial = page.getByTestId('feature-course');
	const video = tutorial.locator('video');
	await expect(video.locator('source').first()).toHaveAttribute(
		'src',
		/\/feature-course-en-.*\.mp4$/
	);
	await video.scrollIntoViewIfNeeded();
	await video.evaluate(async (node) => (node as HTMLVideoElement).play());
	await expect
		.poll(() =>
			video.evaluate((node) => (node as HTMLVideoElement).currentTime)
		)
		.toBeGreaterThan(1);
	expect(
		mp4Failed,
		`Selected source: ${await video.evaluate((node) => (node as HTMLVideoElement).currentSrc)}`
	).toBe(true);
	expect(
		await video.evaluate((node) => (node as HTMLVideoElement).currentSrc)
	).toMatch(/\.webm$/);
	await expect(tutorial.getByRole('status')).toHaveCount(0);
	await video.evaluate((node) => (node as HTMLVideoElement).pause());
});
