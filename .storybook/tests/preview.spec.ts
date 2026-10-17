import { expect, test } from '@playwright/test';
import { coverage } from '../coverage';

const controls = 'components-button--primary';
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
			.getByRole('button', { name: 'Add semester' })
	).toBeVisible();
	await page.reload();
	await expect(
		page
			.frameLocator('#storybook-preview-iframe')
			.getByRole('button', { name: 'Add semester' })
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
	expect(stories.length).toBe(
		coverage.reduce((count, entry) => count + entry.stories.length, 0)
	);
	test.setTimeout(300_000);
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
		const openDatabase = IDBFactory.prototype.open;
		IDBFactory.prototype.open = function (...args) {
			reads.push('IndexedDB:' + args[0]);
			return openDatabase.apply(this, args);
		};
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
		await test.step(story.id, async () => {
			await page.goto(storyUrl(story.id));
			await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
				'data-story-rendered',
				story.id,
				// Storybook waits up to 5s for scroll-linked animations before afterEach.
				{ timeout: 15_000 }
			);
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
		});
	}
	expect(
		await page.evaluate(
			async () => (await navigator.serviceWorker.getRegistrations()).length
		)
	).toBe(0);
	expect(failures).toEqual([]);
});

test('individual controls are interactive and disabled states stay disabled', async ({
	page
}) => {
	await page.goto(storyUrl(controls));
	await page.getByRole('button', { name: 'Add semester' }).click();
	await expect(page.getByText('Semesters added: 1')).toBeVisible();
	await page.goto(storyUrl('components-asyncbutton--primary'));
	await page.getByRole('button', { name: 'Save plan', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Save plan', exact: true })
	).not.toBeVisible();
	await page.getByRole('button', { name: 'Complete demo action' }).click();
	await expect(page.getByText('Completed actions: 1')).toBeVisible();
	await page.goto(storyUrl('components-button--disabled-primary'));
	await expect(
		page.getByRole('button', { name: 'Add semester' })
	).toBeDisabled();
	await page.goto(storyUrl('components-select--disabled'));
	await expect(page.getByRole('combobox')).toBeDisabled();
});

test('theme, language and reading direction are global controls', async ({
	page
}) => {
	await page.goto(
		`${storyUrl(controls)}&globals=theme:light;language:he;direction:rtl`
	);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
	await expect(page.getByRole('button', { name: 'הוספת סמסטר' })).toBeVisible();
	await page.goto(
		`${storyUrl('components-consoleloading--courses')}&globals=theme:dark;language:en;direction:rtl`
	);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.locator('.console-loading')).toHaveAttribute('dir', 'rtl');
	await expect(
		page.getByRole('heading', { name: 'Preparing your planner' })
	).toBeVisible();
	await page.goto(
		`${storyUrl('components-searchfilters--default')}&globals=theme:light;language:en;direction:ltr`
	);
	await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
	await expect(page.getByRole('group')).toBeVisible();
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
	await page.goto(storyUrl('components-appfooter--default'));
	await expect(page.getByRole('combobox').locator('option:checked')).toHaveText(
		'en'
	);
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
	await page.goto(storyUrl('components-landinginstallinfo--default'));
	const before = page.url();
	await page.getByRole('link', { name: 'Open PlanIt' }).click();
	expect(page.url()).toBe(before);
	await page.goto(storyUrl('components-appfooter--default'));
	const footerUrl = page.url();
	await page.locator('a[href="https://github.com/selfint"]').click();
	expect(page.url()).toBe(footerUrl);
	expect(context.pages()).toHaveLength(1);
});

test('CourseGroup resolves actual async data and exposes loading and error states', async ({
	page
}) => {
	await page.goto(storyUrl('components-coursegroup--default'));
	await expect(
		page.getByText('Example foundations · יסודות לדוגמה')
	).toBeVisible();
	await expect(page.locator('a[href="/app/course/00000001"]')).toBeVisible();
	await page.goto(storyUrl('components-coursegroup--loading'));
	await expect(page.getByRole('status')).toBeVisible();
	await expect(
		page.getByText('Example foundations · יסודות לדוגמה')
	).not.toBeVisible();
	await page.goto(storyUrl('components-coursegroup--error'));
	await expect(page.getByRole('alert')).toBeVisible();
});

test('PWA presentation supports retry and dismiss without starting worker lifecycle', async ({
	page
}) => {
	await page.goto(storyUrl('components-pwastatus--unavailable'));
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByText('Retry requests: 1')).toBeVisible();
	await page.goto(storyUrl('components-pwastatus--update'));
	await expect(page.getByTestId('pwa-update')).toBeVisible();
	await page.getByRole('button', { name: 'Dismiss update notice' }).click();
	await expect(page.getByTestId('pwa-update')).not.toBeVisible();
	await page.goto(storyUrl('components-pwastatus--ready'));
	await expect(page.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready'
	);
	expect(
		await page.evaluate(
			async () => (await navigator.serviceWorker.getRegistrations()).length
		)
	).toBe(0);
});

test('account-status presentation covers loading, retry, sign-out and offline guards', async ({
	page
}) => {
	await page.goto(storyUrl('components-consoleaccountstatus--auth-pending'));
	await expect(page.getByRole('status')).toContainText('Loading');
	await page.goto(
		storyUrl('components-consoleaccountstatus--account-unavailable')
	);
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByText('Retry requests: 1')).toBeVisible();
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page.getByText('Sign-out requests: 1')).toBeVisible();
	await page.goto(
		storyUrl('components-consoleaccountstatus--offline-account-unavailable')
	);
	await expect(page.getByTestId('plan-read-only')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Try again' })).toBeDisabled();
});

test('degree path and recommendation variants show their real controls', async ({
	page
}) => {
	await page.goto(storyUrl('components-degreesection--with-paths'));
	await expect(page.getByRole('combobox')).toHaveCount(4);
	await expect(page.locator('option[value="example-path"]')).toHaveText(
		'Example path'
	);
	await page.goto(storyUrl('components-degreesection--selected-path'));
	await expect(page.getByRole('combobox').last()).toHaveValue('example-path');
	await page.goto(storyUrl('components-degreesection--recommended'));
	await page.getByRole('button', { name: 'Revert to recommended' }).click();
	await expect(page.getByText('Demo reset requested')).toBeVisible();
});
