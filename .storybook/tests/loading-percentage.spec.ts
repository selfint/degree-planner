import { expect, test } from '@playwright/test';
const iframe = process.env.STORYBOOK_FLOW_PATH ?? '/storybook/iframe.html';
test.beforeEach(async ({ context, baseURL }) => {
	await context.route('**/*', (route) =>
		new URL(route.request().url()).origin === new URL(baseURL!).origin
			? route.continue()
			: route.abort()
	);
});
for (const width of [320, 375, 390])
	for (const language of ['en', 'he']) {
		test(`${width}px ${language}: percentage phrase stays together and processing stays separate`, async ({
			page
		}, info) => {
			await page.setViewportSize({ width, height: 844 });
			await page.goto(
				`${iframe}?id=user-flows-startup-loading--cold-entry&globals=language:${language}`
			);
			await page.getByRole('button', { name: 'Replay', exact: true }).click();
			await expect
				.poll(
					async () =>
						Number(
							await page.getByRole('progressbar').getAttribute('aria-valuenow')
						),
					{ timeout: 15000 }
				)
				.toBeGreaterThan(35);
			await page.getByRole('button', { name: 'Pause', exact: true }).click();
			const status = page.locator('.console-loading__status');
			await expect(status).toContainText('%');
			await expect(status).not.toContainText('MB');
			const lines = await status.evaluate((element) => {
				const range = document.createRange();
				range.selectNodeContents(element);
				return [...range.getClientRects()].map((r) => ({
					top: r.top,
					left: r.left,
					right: r.right
				}));
			});
			expect(
				Math.max(...lines.map((r) => r.top)) -
					Math.min(...lines.map((r) => r.top))
			).toBeLessThan(1);
			for (const line of lines) {
				expect(line.left).toBeGreaterThanOrEqual(0);
				expect(line.right).toBeLessThanOrEqual(width);
			}

			await page.screenshot({ path: info.outputPath('percentage.png') });
			await page
				.getByRole('button', { name: 'Next phase', exact: true })
				.click();
			await expect(page.locator('.flow-demo')).toHaveAttribute(
				'data-flow-phase',
				'Processing data'
			);
			await expect(status).not.toContainText('%');
			await expect(status).not.toContainText('MB');
			await expect(page.locator('.console-loading__status')).not.toBeEmpty();
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth)
			).toBeLessThanOrEqual(width);
			await page.screenshot({ path: info.outputPath('processing.png') });
		});
	}
