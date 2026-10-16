import { expect, test } from '@playwright/test';

const origin = 'http://localhost:4173';

// Include enough layout state in CI artifacts to distinguish a scroll bug from
// a late image/font reflow without weakening the document-height assertions.
function layoutSnapshot() {
	const box = (node: Element) => {
		const { x, y, width, height } = node.getBoundingClientRect();
		return { x, y: y + scrollY, width, height };
	};
	return {
		scroll: scrollY,
		height: document.documentElement.scrollHeight,
		clientHeight: document.documentElement.clientHeight,
		body: box(document.body),
		fontStatus: document.fonts.status,
		landing: box(document.querySelector('.landing')!),
		footer: box(document.querySelector('footer')!),
		images: Array.from(
			document.querySelectorAll<HTMLImageElement>('.landing img')
		).map((node) => ({
			alt: node.alt,
			complete: node.complete,
			naturalWidth: node.naturalWidth,
			section: box(
				node.closest('picture')!.parentElement!.parentElement!.parentElement!
			),
			...box(node)
		}))
	};
}

for (const viewport of [
	{ width: 1280, height: 800 },
	{ width: 390, height: 844 },
	{ width: 320, height: 740 }
]) {
	for (const { language, theme } of [
		{ language: 'en', theme: 'dark' },
		{ language: 'he', theme: 'light' }
	]) {
		test(`parallax preserves ${theme} ${language} layout at ${viewport.width}`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize(viewport);
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.addInitScript(
				({ language, theme }) => {
					localStorage.setItem('lang', language);
					localStorage.setItem('theme', theme);
				},
				{ language, theme }
			);
			await page.goto(origin);
			const landing = page.locator('.landing');
			const glow = page.locator('.landing-gradient');
			await expect(landing).toHaveAttribute(
				'dir',
				language === 'he' ? 'rtl' : 'ltr'
			);
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await expect(glow).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
			// Loaded web fonts can change text wrapping independently of parallax.
			await page.evaluate(() => document.fonts.ready);
			const initial = await landing.boundingBox();
			const initialHeight = await page.evaluate(
				() => document.documentElement.scrollHeight
			);
			await testInfo.attach('layout-top', {
				body: JSON.stringify(await page.evaluate(layoutSnapshot), null, 2),
				contentType: 'application/json'
			});
			await page.screenshot({ path: testInfo.outputPath('landing-top.png') });
			await page.mouse.wheel(0, 600);
			// WebKit animates wheel input. Wait for the requested position, then
			// sample geometry and scroll in one frame rather than racing separate reads.
			await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(600, 0);
			await expect
				.poll(() =>
					glow.evaluate((node) =>
						Math.abs(
							new DOMMatrixReadOnly(getComputedStyle(node).transform).m42 -
								scrollY * 0.8
						)
					)
				)
				.toBeLessThan(0.1);
			const after = await landing.evaluate((node) => {
				const { height, y } = node.getBoundingClientRect();
				return { height, documentY: y + scrollY };
			});
			expect(after.height).toBe(initial?.height);
			expect(after.documentY).toBeCloseTo(initial!.y, 0);
			expect(
				await page.evaluate(() => document.documentElement.scrollHeight)
			).toBe(initialHeight);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth
				)
			).toBe(true);
			await expect(page.locator('.landing-background')).toHaveAttribute(
				'aria-hidden',
				'true'
			);
			await expect(page.locator('.landing-background')).toHaveCSS(
				'pointer-events',
				'none'
			);
			await page.screenshot({
				path: testInfo.outputPath('landing-scrolled.png')
			});
			// Check the whole journey, not just the first scroll out of the hero.
			for (const [label, progress] of [
				['midpoint', 0.5],
				['bottom', 1]
			] as const) {
				const target = Math.round((initialHeight - viewport.height) * progress);
				await page.mouse.wheel(
					0,
					target - (await page.evaluate(() => scrollY))
				);
				await expect
					.poll(() => page.evaluate(() => scrollY))
					.toBeCloseTo(target, 0);
				await expect
					.poll(() =>
						glow.evaluate((node) =>
							Math.abs(
								new DOMMatrixReadOnly(getComputedStyle(node).transform).m42 -
									scrollY * 0.8
							)
						)
					)
					.toBeLessThan(0.1);
				await testInfo.attach(`layout-${label}`, {
					body: JSON.stringify(await page.evaluate(layoutSnapshot), null, 2),
					contentType: 'application/json'
				});
				const bounds = await glow.boundingBox();
				// The translated decoration still covers the visible landing area.
				expect(bounds!.y).toBeLessThanOrEqual(0);
				expect(bounds!.y + bounds!.height).toBeGreaterThanOrEqual(
					viewport.height
				);
				expect(
					await page.evaluate(() => document.documentElement.scrollHeight)
				).toBe(initialHeight);
				expect(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth
					)
				).toBe(true);
				await page.screenshot({
					path: testInfo.outputPath(`landing-${label}.png`)
				});
			}
			await page.keyboard.press('Home');
			await page
				.locator('main')
				.getByText(language === 'he' ? 'התחל' : 'Get Started', {
					exact: true
				})
				.first()
				.click();
			await expect(page).toHaveURL(/\/settings/);
			await page.goBack();
			await expect(glow).toBeVisible();
			await page.mouse.wheel(0, 300);
			await expect
				.poll(() =>
					glow.evaluate(
						(node) =>
							new DOMMatrixReadOnly(getComputedStyle(node).transform).m42
					)
				)
				.toBeGreaterThan(0);
		});
	}
}

test('reduced motion stays static and updates when the preference changes', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(origin);
	const glow = page.locator('.landing-gradient');
	await expect(glow).toHaveCSS('transform', 'none');
	await page.mouse.wheel(0, 600);
	await expect(glow).toHaveCSS('transform', 'none');
	await expect(glow).not.toHaveAttribute(
		'style',
		/--landing-parallax-(offset|travel)/
	);
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await expect
		.poll(() =>
			glow.evaluate(
				(node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42
			)
		)
		.toBeGreaterThan(0);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(glow).toHaveCSS('transform', 'none');
	await expect(glow).not.toHaveAttribute(
		'style',
		/--landing-parallax-(offset|travel)/
	);
});

// Mobile-sized, high-density rendering with rapid wheel input. Playwright's
// mobile WebKit rejects wheel input, so this is not physical iOS fling coverage.
// The dedicated browser job retains recordings for transient visual review.
test.describe('rapid mobile scrolling', () => {
	test.use({
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		isMobile: false,
		deviceScaleFactor: 3
	});

	for (const fallback of [false, true]) {
		for (const { language, theme } of [
			{ language: 'en', theme: 'dark' },
			{ language: 'he', theme: 'light' }
		]) {
			test(`${fallback ? 'fallback' : 'native'} handles fast reversals in ${language}`, async ({
				page
			}, testInfo) => {
				await page.setViewportSize({ width: 390, height: 844 });
				await page.emulateMedia({ reducedMotion: 'no-preference' });
				await page.addInitScript(
					({ language, theme, fallback }) => {
						localStorage.setItem('lang', language);
						localStorage.setItem('theme', theme);
						if (fallback) {
							const supports = CSS.supports.bind(CSS);
							CSS.supports = ((property: string, value?: string) =>
								property === 'animation-timeline'
									? false
									: value === undefined
										? supports(property)
										: supports(property, value)) as typeof CSS.supports;
						}
					},
					{ language, theme, fallback }
				);
				await page.goto(origin);
				const glow = page.locator('.landing-gradient');
				const native =
					!fallback &&
					(await page.evaluate(() =>
						CSS.supports('animation-timeline', 'scroll(root y)')
					));
				await expect(glow).toHaveAttribute(
					'data-parallax',
					native ? 'native' : 'fallback'
				);
				if (native) {
					await expect
						.poll(() =>
							glow.evaluate((node) =>
								node
									.getAnimations()
									.some((animation) => animation.timeline !== document.timeline)
							)
						)
						.toBe(true);
				}

				for (let burst = 0; burst < 3; burst++) {
					for (const distance of [
						1800, 1400, -900, 1600, -2100, -1800, 2400, -3200
					]) {
						await page.mouse.wheel(0, distance);
						// Intentional short cadence: don't wait for the previous scroll to settle.
						await page.waitForTimeout(40);
					}
				}
				await page.mouse.wheel(0, 2200);
				await expect
					.poll(() =>
						glow.evaluate((node) =>
							Math.abs(
								new DOMMatrixReadOnly(getComputedStyle(node).transform).m42 -
									Math.min(
										document.documentElement.scrollHeight -
											document.documentElement.clientHeight,
										Math.max(0, scrollY)
									) *
										0.8
							)
						)
					)
					.toBeLessThan(1);
				if (native)
					await expect(glow).not.toHaveAttribute(
						'style',
						/--landing-parallax-offset/
					);
				expect(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth
					)
				).toBe(true);
				await page.screenshot({
					path: testInfo.outputPath('landing-rapid-scroll.png')
				});
				await testInfo.attach('scroll-engine', {
					body: JSON.stringify(
						await page.evaluate(() => ({
							userAgent: navigator.userAgent,
							mode: document.querySelector<HTMLElement>('.landing-gradient')
								?.dataset.parallax,
							scroll: scrollY,
							transform: getComputedStyle(
								document.querySelector('.landing-gradient')!
							).transform
						})),
						null,
						2
					),
					contentType: 'application/json'
				});

				await page.emulateMedia({ reducedMotion: 'reduce' });
				await expect(glow).toHaveCSS('transform', 'none');
				await expect(glow).not.toHaveAttribute(
					'style',
					/--landing-parallax-(offset|travel)/
				);
				await expect
					.poll(() => glow.evaluate((node) => node.getAnimations().length))
					.toBe(0);
			});
		}
	}
});

for (const width of [390, 1280]) {
	for (const language of ['en', 'he']) {
		test(`lazy demo images reserve space before decoding in ${language} at ${width}`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize({ width, height: 844 });
			await page.addInitScript(
				(language) => localStorage.setItem('lang', language),
				language
			);
			let releaseImages!: () => void;
			const imagesMayLoad = new Promise<void>((resolve) => {
				releaseImages = resolve;
			});
			await page.route(
				/-pic\.[^/]+\.(avif|webp|png)(?:\?.*)?$/,
				async (route) => {
					await imagesMayLoad;
					await route.continue();
				}
			);
			try {
				await page.goto(origin, { waitUntil: 'domcontentloaded' });
				await expect(page.locator('.landing')).toHaveAttribute(
					'dir',
					language === 'he' ? 'rtl' : 'ltr'
				);
				await expect(page.locator('.landing-gradient')).toHaveAttribute(
					'data-parallax',
					/native|fallback/
				);
				await page.evaluate(() => document.fonts.ready);
				const before = await page.evaluate(layoutSnapshot);
				await testInfo.attach('layout-before-images', {
					body: JSON.stringify(before, null, 2),
					contentType: 'application/json'
				});
				expect(before.images).toHaveLength(7);
				for (const image of before.images) {
					expect(image.naturalWidth).toBe(0);
					expect(image.width).toBeGreaterThan(0);
					expect(image.height).toBeGreaterThan(0);
				}
				// Release the actual images only after recording the cold layout.
				// Eager loading here makes the test deterministic without changing app policy.
				await page
					.locator('.landing img')
					.evaluateAll((images) =>
						images.forEach(
							(image) => ((image as HTMLImageElement).loading = 'eager')
						)
					);
				releaseImages();
				await expect
					.poll(() =>
						page
							.locator('.landing img')
							.evaluateAll((images) =>
								images.every(
									(image) =>
										(image as HTMLImageElement).complete &&
										(image as HTMLImageElement).naturalWidth > 0
								)
							)
					)
					.toBe(true);
				const after = await page.evaluate(layoutSnapshot);
				await testInfo.attach('layout-after-images', {
					body: JSON.stringify(after, null, 2),
					contentType: 'application/json'
				});
				expect(after.height).toBe(before.height);
				expect(after.landing).toEqual(before.landing);
				expect(after.footer).toEqual(before.footer);
				for (let i = 0; i < before.images.length; i++) {
					for (const dimension of ['x', 'y', 'width', 'height'] as const) {
						expect(after.images[i][dimension]).toBeCloseTo(
							before.images[i][dimension],
							1
						);
					}
				}
			} finally {
				releaseImages();
				await page.unrouteAll({ behavior: 'wait' });
			}
		});
	}
}
