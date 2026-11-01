import { expect, test } from '@playwright/test';

// Exercise the real consumers, not a duplicate button-gallery implementation.
const primaryStories = [
	'components-button--primary',
	'components-asyncbutton--primary',
	'components-planactionbutton--primary',
	'components-degreesection--with-paths',
	'components-semestersection--unsaved-changes',
	'components-uploadsection--default',
	'components-uploadsection--parsed-transcript'
];
for (const theme of ['dark', 'light']) {
	for (const language of ['en', 'he']) {
		for (const width of [320, 390]) {
			test(`shared primary contract ${theme}/${language}/${width}`, async ({
				page
			}) => {
				await page.setViewportSize({ width, height: 800 });
				for (const id of primaryStories) {
					await page.goto(
						`/storybook/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};language:${language}`
					);
					await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
						'data-story-rendered',
						id
					);
					if (id === 'components-degreesection--with-paths') {
						const path = page.getByRole('combobox').last();
						await expect(
							path.locator('option[value="example-path"]')
						).toHaveCount(1);
						await path.selectOption('example-path');
					}
					const buttons = page.locator('.ui-button--primary');
					expect(await buttons.count(), id).toBeGreaterThan(0);
					for (const button of await buttons.all()) {
						await expect(button, id).toHaveCSS(
							'background-color',
							'rgb(15, 111, 103)'
						);
						await expect(button, id).toHaveCSS('color', 'rgb(255, 255, 255)');
						await expect(button, id).toHaveCSS('height', '36px');
						await expect(button, id).toHaveCSS('padding-inline-start', '8px');
						await expect(button, id).toHaveCSS('white-space', 'nowrap');
						const bounds = await button.boundingBox();
						expect(bounds?.width, id).toBeGreaterThan(0);
						expect(bounds!.x, id).toBeGreaterThanOrEqual(0);
						expect(bounds!.x + bounds!.width, id).toBeLessThanOrEqual(width);
					}
				}
			});
		}
	}
}

test('async primitive keeps its lock, keyboard focus, and secondary variant', async ({
	page
}) => {
	await page.goto(
		'/storybook/iframe.html?id=components-asyncbutton--shared-action-lock&viewMode=story'
	);
	await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
		'data-story-rendered',
		'components-asyncbutton--shared-action-lock'
	);
	const primary = page.locator('.ui-button--primary');
	await expect(primary).toBeDisabled();
	await expect(primary).toHaveAttribute('aria-busy', 'true');
	await expect(
		page.getByRole('button', { name: 'Export plan' })
	).toBeDisabled();
	await page.getByRole('button', { name: 'Complete demo action' }).click();
	await expect(primary).toBeEnabled();
	// Use real keyboard navigation: programmatic focus after a pointer action
	// intentionally does not trigger :focus-visible in Chromium.
	await page.getByRole('button', { name: 'Export plan' }).press('Shift+Tab');
	await expect(primary).toHaveCSS('outline-style', 'solid');
	await primary.press('Enter');
	await expect(primary).toBeDisabled();
	await expect(
		page.getByRole('button', { name: 'Export plan' })
	).toBeDisabled();
});

test('disabled upload shares disabled paint and never gains a hover halo', async ({
	page
}) => {
	await page.goto(
		'/storybook/iframe.html?id=components-uploadsection--offline&viewMode=story'
	);
	await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
		'data-story-rendered',
		'components-uploadsection--offline'
	);
	const upload = page.locator('.upload-trigger');
	await expect(upload.locator('input')).toBeDisabled();
	await expect(upload).toHaveCSS('opacity', '0.45');
	await upload.hover({ force: true });
	await expect(upload).toHaveCSS('box-shadow', 'none');
});
