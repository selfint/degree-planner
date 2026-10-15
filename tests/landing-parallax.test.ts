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
			expect(offset).toBeCloseTo(scroll * 0.16, 0);
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
	await expect(glow).not.toHaveAttribute('style', /--landing-parallax-offset/);
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
	await expect(glow).not.toHaveAttribute('style', /--landing-parallax-offset/);
});
