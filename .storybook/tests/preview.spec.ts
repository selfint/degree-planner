import { expect, test } from '@playwright/test';

const controls = 'planner-controls--default';
const storyUrl = (id: string) =>
	`/storybook/iframe.html?id=${id}&viewMode=story`;

test('deployed /storybook opens the real Storybook manager and survives a direct reload', async ({
	page,
	request
}) => {
	const redirect = await request.get(`/storybook?path=/story/${controls}`, {
		maxRedirects: 0
	});
	expect(redirect.status()).toBe(307);
	const target = new URL(redirect.headers().location, redirect.url());
	expect(target.origin).toBe(new URL(redirect.url()).origin);
	expect(target.pathname).toBe('/storybook/index.html');
	expect(target.searchParams.get('path')).toBe(`/story/${controls}`);
	const slash = await request.get('/storybook/');
	expect(slash.ok()).toBe(true);
	await page.goto(`/storybook?path=/story/${controls}`);
	await expect(page.locator('#storybook-preview-iframe')).toBeVisible();
	await expect(
		page
			.frameLocator('#storybook-preview-iframe')
			.getByRole('heading', { name: 'Planner controls' })
	).toBeVisible();
	await page.reload();
	await expect(
		page
			.frameLocator('#storybook-preview-iframe')
			.getByRole('heading', { name: 'Planner controls' })
	).toBeVisible();
});

test('all stories render without live data, account access, or planner storage changes', async ({
	page,
	request,
	baseURL
}) => {
	const index = await request.get('/storybook/index.json');
	expect(index.ok()).toBe(true);
	const entries = Object.values((await index.json()).entries) as {
		id: string;
		type: string;
	}[];
	const stories = entries.filter((entry) => entry.type === 'story');
	expect(stories.length).toBeGreaterThanOrEqual(14);
	const failures: string[] = [];
	page.on('pageerror', (error) => failures.push(error.message));
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (!['http:', 'https:'].includes(url.protocol)) return;
		if (
			url.origin !== new URL(baseURL!).origin ||
			/(?:_courses|_catalogs|courseData|catalogs\.json|service-worker)/.test(
				url.pathname
			)
		)
			failures.push(`Unexpected request: ${url.origin}${url.pathname}`);
	});
	await page.addInitScript(() => {
		localStorage.setItem('userData', '{"storybookSentinel":true}');
		localStorage.setItem('theme', 'sentinel');
		localStorage.setItem('lang', 'sentinel');
		localStorage.setItem('version', 'sentinel');
		const reads: string[] = [];
		Object.assign(window, { plannerStorageReads: reads });
		const original = Storage.prototype.getItem;
		Storage.prototype.getItem = function (key) {
			if (
				[
					'userData',
					'version',
					'lang',
					'theme',
					'username',
					'degree',
					'semesters',
					'wishlist'
				].includes(key)
			)
				reads.push(key);
			return original.call(this, key);
		};
	});
	for (const story of stories) {
		await page.goto(storyUrl(story.id));
		await expect(
			page.locator('#storybook-root section, #storybook-root footer').first()
		).toBeVisible();
		await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
		expect(
			await page.evaluate(
				() =>
					(window as Window & { plannerStorageReads: string[] })
						.plannerStorageReads
			)
		).toEqual([]);
		expect(
			await page.evaluate(() => ({
				data: localStorage.getItem('userData'),
				theme: localStorage.getItem('theme'),
				lang: localStorage.getItem('lang'),
				version: localStorage.getItem('version')
			}))
		).toEqual({
			data: '{"storybookSentinel":true}',
			theme: 'sentinel',
			lang: 'sentinel',
			version: 'sentinel'
		});
	}
	expect(
		await page.evaluate(
			async () => (await navigator.serviceWorker.getRegistrations()).length
		)
	).toBe(0);
	expect(failures).toEqual([]);
});

test('controls are interactive and disabled states cannot change demo data', async ({
	page
}) => {
	await page.goto(storyUrl(controls));
	await page.getByRole('button', { name: 'Add semester' }).click();
	await expect(page.getByText('Semesters added: 1')).toBeVisible();
	await page.getByRole('button', { name: 'Try loading state' }).click();
	await expect(
		page.getByRole('button', { name: 'Try loading state' })
	).not.toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Try loading state' })
	).toBeVisible();
	await page.goto(storyUrl('planner-controls--disabled'));
	await expect(
		page.getByRole('button', { name: 'Add semester' })
	).toBeDisabled();
	await expect(page.getByRole('combobox')).toBeDisabled();
});

test('light theme, Hebrew RTL, and narrow mobile render without overflow', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${storyUrl(controls)}&globals=theme:light;language:he`);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
	await expect(page.getByRole('heading', { name: 'פקדים' })).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth
		)
	).toBe(true);
});

test('the app service worker and app HTML do not load Storybook', async ({
	request
}) => {
	const worker = await request.get('/service-worker.js');
	expect(worker.ok()).toBe(true);
	expect(await worker.text()).not.toMatch(/storybook|src\/stories/i);
	for (const route of ['/', '/app/offline']) {
		const response = await request.get(route);
		expect(response.ok()).toBe(true);
		expect(await response.text()).not.toMatch(
			/(?:src|href)=["'][^"']*storybook/i
		);
	}
});

test('footer controls leave real planner preferences untouched', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('theme', 'dark');
		localStorage.setItem('lang', 'en');
	});
	await page.goto(storyUrl('planner-footer--default'));
	await page.getByRole('button').click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await page.getByRole('combobox').selectOption({ label: 'עב' });
	await expect(page.getByRole('combobox').locator('option:checked')).toHaveText(
		'עב'
	);
	expect(
		await page.evaluate(() => [
			localStorage.getItem('theme'),
			localStorage.getItem('lang')
		])
	).toEqual(['dark', 'en']);
});

test('footer and installation links are mocked and cannot leave the story', async ({
	page,
	context
}) => {
	await page.goto(storyUrl('planner-footer--installation-help'));
	const before = page.url();
	await page.getByRole('link', { name: 'Open PlanIt' }).click();
	expect(page.url()).toBe(before);
	await page.locator('a[href="https://github.com/selfint"]').click();
	expect(page.url()).toBe(before);
	expect(context.pages()).toHaveLength(1);
});
