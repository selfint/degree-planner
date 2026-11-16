import { expect, test } from '@playwright/test';
const iframe = process.env.STORYBOOK_FLOW_PATH ?? '/storybook/iframe.html';
test.beforeEach(async ({ context, baseURL }) => {
	await context.route('**/*', (r) =>
		new URL(r.request().url()).origin === new URL(baseURL!).origin
			? r.continue()
			: r.abort()
	);
});
for (const theme of ['dark', 'light'])
	for (const language of ['en', 'he']) {
		test(`${theme} ${language}: download stays complete through remaining work without moving the brand`, async ({
			page
		}, info) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(
				`${iframe}?id=user-flows-startup-loading--cold-entry&globals=theme:${theme};language:${language}`
			);
			await page.getByRole('button', { name: 'Pause', exact: true }).click();
			await page.getByRole('button', { name: 'Replay', exact: true }).click();
			await page.getByRole('button', { name: 'Pause', exact: true }).click();
			const next = page.getByRole('button', {
				name: 'Next phase',
				exact: true
			});
			await next.click();
			await next.click();
			await expect(page.getByRole('progressbar')).toHaveAttribute(
				'aria-valuenow',
				'0'
			);
			const brand = await page.locator('.console-loading__brand').boundingBox();
			await next.click();
			await expect(page.getByRole('progressbar')).toHaveAttribute(
				'aria-valuenow',
				'100'
			);
			for (const stage of [
				'Processing data',
				'Saving data offline',
				'Account / update readiness'
			]) {
				await expect(page.locator('.flow-demo')).toHaveAttribute(
					'data-flow-phase',
					stage
				);
				await expect(page.getByRole('progressbar')).toHaveAttribute(
					'aria-valuenow',
					'100'
				);
				await expect(
					page.locator('.console-loading__download')
				).not.toBeEmpty();
				expect(
					(await page.locator('.console-loading__brand').boundingBox())!.y
				).toBeCloseTo(brand!.y, 0);
				await expect
					.poll(async () =>
						page
							.locator('.console-loading__track')
							.evaluate((e) =>
								Math.abs(
									e.getBoundingClientRect().width -
										e.firstElementChild!.getBoundingClientRect().width
								)
							)
					)
					.toBeLessThan(1);
				await page.screenshot({
					path: info.outputPath(stage.replaceAll('/', '-') + '.png')
				});
				await next.click();
			}
			await expect(page.locator('.console-loading')).toHaveCount(0);
			await page.getByRole('button', { name: 'Replay', exact: true }).click();
			await expect(page.locator('.console-loading')).toHaveCount(1);
			await page.screenshot({ path: info.outputPath('replay.png') });
		});
	}
test('a real network pause keeps the measured amount still; unknown/cache flows claim no percentage', async ({
	page
}) => {
	await page.goto(`${iframe}?id=user-flows-startup-loading--network-pause`);
	await expect(page.locator('.flow-demo')).toHaveAttribute(
		'data-flow-phase',
		'Network pause — bytes stay still',
		{ timeout: 15000 }
	);
	const value = await page
		.getByRole('progressbar')
		.getAttribute('aria-valuenow');
	await page.waitForTimeout(700);
	expect(
		await page.getByRole('progressbar').getAttribute('aria-valuenow')
	).toBe(value);
	for (const scenario of ['unknown-size', 'cached-entry']) {
		await page.goto(`${iframe}?id=user-flows-startup-loading--${scenario}`);
		await page.getByRole('button', { name: 'Pause', exact: true }).click();
		await page.getByRole('button', { name: 'Next phase', exact: true }).click();
		await expect(page.getByRole('progressbar')).not.toHaveAttribute(
			'aria-valuenow'
		);
	}
});
