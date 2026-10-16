import { expect, test } from '@playwright/test';

const origin = 'http://localhost:4173';

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
			const initial = await landing.boundingBox();
			const initialHeight = await page.evaluate(
				() => document.documentElement.scrollHeight
			);
			await page.screenshot({ path: testInfo.outputPath('landing-top.png') });
			await page.mouse.wheel(0, 600);
			await expect
				.poll(() =>
					glow.evaluate(
						(node) =>
							new DOMMatrixReadOnly(getComputedStyle(node).transform).m42
					)
				)
				.toBeGreaterThan(0);
			const scroll = await page.evaluate(() => window.scrollY);
			const offset = await glow.evaluate(
				(node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42
			);
			expect(offset).toBeCloseTo(scroll * 0.8, 0);
			const after = await landing.boundingBox();
			expect(after?.height).toBe(initial?.height);
			expect(after!.y + scroll).toBeCloseTo(initial!.y, 0);
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
