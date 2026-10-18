import { expect, test, type Locator } from '@playwright/test';
import { pwaMessages } from '../../src/lib/pwa/messages';
import { coverage } from '../coverage';

const controls = 'components-button--primary';
const storyUrl = (id: string) =>
	`/storybook/iframe.html?id=${id}&viewMode=story`;

async function expectCompactAction(button: Locator) {
	await expect(button).toHaveCSS('white-space', 'nowrap');
	const box = await button.boundingBox();
	expect(box!.height).toBeGreaterThanOrEqual(35.5);
	expect(box!.height).toBeLessThanOrEqual(36.5);
}

async function expectRailReadingEdge(
	rail: Locator,
	items: string,
	direction: string
) {
	await expect
		.poll(() =>
			rail.evaluate(
				(el, { items, direction }) => {
					const bounds = el.getBoundingClientRect();
					const first = el.querySelector(items)!.getBoundingClientRect();
					const start =
						direction === 'rtl' ? el.scrollWidth - el.clientWidth : 0;
					return {
						atReadingEdge: Math.abs(el.scrollLeft - start) <= 1,
						firstFullyVisible:
							first.left >= bounds.left - 0.5 &&
							first.right <= bounds.right + 0.5
					};
				},
				{ items, direction }
			)
		)
		.toEqual({ atReadingEdge: true, firstFullyVisible: true });
}

async function expectOriginalCardHierarchy(card: Locator) {
	const body = card.locator('.course-body');
	const name = body.locator('.course-copy > .course-name');
	await expect(name).toBeVisible();
	const title = await name.getAttribute('title');
	expect(title).toBeTruthy();
	await expect(name).toHaveText(title!);
	await expect(name).toHaveCSS('display', 'inline');
	await expect(name).toHaveCSS('white-space', 'normal');
	await expect(body.locator('.course-copy')).toHaveCSS('white-space', 'normal');
	await expect(body.locator('.course-copy')).toHaveCSS('overflow', 'visible');
	await expect(body.locator('.course-copy')).toHaveCSS(
		'-webkit-line-clamp',
		'none'
	);
	await expect(body.locator('.course-name + .course-code')).toHaveCount(1);
	await expect(body.locator('.course-code')).toHaveCSS('display', 'inline');
	await expect(body.locator('.course-code')).toHaveAttribute('dir', 'ltr');
	await expect(
		body.locator('.course-meta .course-markers .course-marker')
	).toBeVisible();
	await expect(
		body.locator('.course-meta .course-stats > .course-median')
	).toBeVisible();
	await expect(body.locator('.course-median + .course-points')).toBeVisible();
	await expect(body).toHaveCSS('padding', '6px');
	const hierarchy = await body.evaluate((el) => {
		const meta = el.querySelector('.course-meta')!;
		const copy = el.querySelector('.course-copy')!;
		return {
			children: Array.from(el.children, (child) =>
				child.classList.contains('course-meta')
					? 'metadata'
					: child.classList.contains('course-copy')
						? 'copy'
						: 'other'
			),
			metadataBottom: meta.getBoundingClientRect().bottom,
			copyTop: copy.getBoundingClientRect().top
		};
	});
	expect(hierarchy.children).toEqual(['metadata', 'copy']);
	expect(hierarchy.metadataBottom).toBeLessThanOrEqual(hierarchy.copyTop);
}

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
	await expectCompactAction(page.getByRole('button', { name: 'Add semester' }));
	await page.getByRole('button', { name: 'Add semester' }).click();
	await expect(page.getByText('Semesters added: 1')).toBeVisible();
	await page.goto(storyUrl('components-asyncbutton--primary'));
	const save = page.getByRole('button', { name: 'Save plan', exact: true });
	await expectCompactAction(save);
	const idleWidth = (await save.boundingBox())!.width;
	await save.click();
	await expect(
		page.getByRole('button', { name: 'Save plan', exact: true })
	).toBeDisabled();
	await expect(
		page.getByRole('button', { name: 'Save plan', exact: true })
	).toHaveAttribute('aria-busy', 'true');
	await expectCompactAction(save);
	expect((await save.boundingBox())!.width).toBe(idleWidth);
	await page.getByRole('button', { name: 'Complete demo action' }).click();
	await expect(page.getByText('Completed actions: 1')).toBeVisible();
	await page.goto(storyUrl('components-button--disabled-primary'));
	await expect(
		page.getByRole('button', { name: 'Add semester' })
	).toBeDisabled();
	await page.goto(storyUrl('components-select--disabled'));
	await expect(page.getByRole('combobox')).toBeDisabled();
	for (const state of ['offline', 'offline-hidden-reason']) {
		await page.goto(storyUrl(`components-planactionbutton--${state}`));
		const action = page.getByRole('button', { name: 'Save demo plan' });
		await expect(action).toBeDisabled();
		await expectCompactAction(action);
		await expect(action).toHaveAccessibleDescription(
			/Reconnect to edit or save/
		);
		await expect(page.getByText('Demo saves: 0')).toBeVisible();
		const reason = await action.evaluate((el) => {
			const reason = document.getElementById(
				el.getAttribute('aria-describedby')!
			);
			return (
				reason && {
					position: getComputedStyle(reason).position,
					height: reason.getBoundingClientRect().height
				}
			);
		});
		expect(reason).not.toBeNull();
		if (state === 'offline-hidden-reason') {
			expect(reason!.position).toBe('absolute');
			expect(reason!.height).toBeLessThanOrEqual(1);
		} else expect(reason!.height).toBeGreaterThan(1);
	}
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
		page.locator('.console-loading').getByRole('heading')
	).toHaveCount(0);
	await expect(page.locator('.console-loading__logo')).toBeVisible();
	await expect(
		page.getByRole('img', { name: 'PlanIt', exact: true })
	).toBeVisible();
	await expect(page.locator('.console-loading__track')).toBeVisible();
	await expect(page.getByRole('status')).toHaveText('Loading courses…');
	await expect(page.getByRole('status')).toHaveCSS('clip-path', 'inset(50%)');
	await page.goto(
		`${storyUrl('components-searchfilters--default')}&globals=theme:light;language:en;direction:ltr`
	);
	await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
	await expect(
		page.getByRole('group', { name: 'Filters', exact: true })
	).toBeVisible();
	await page.goto(storyUrl('components-pwastatus--cached-refresh-failure'));
	await expect(page.getByTestId('pwa-refresh-error')).toHaveText(
		pwaMessages.en.cachedRefreshFailed
	);
	for (const language of ['he', 'en'] as const) {
		// Use the same Storybook channel event as its toolbar, without reloading
		// the iframe: global changes must keep the active fixture's details.
		await page.evaluate((language) => {
			const channel = (
				window as Window & {
					__STORYBOOK_ADDONS_CHANNEL__: {
						emit: (event: string, payload: unknown) => void;
					};
				}
			).__STORYBOOK_ADDONS_CHANNEL__;
			channel.emit('updateGlobals', {
				globals: {
					language,
					theme: language === 'he' ? 'light' : 'dark',
					direction: language === 'he' ? 'rtl' : 'ltr'
				}
			});
		}, language);
		await expect(page.locator('html')).toHaveAttribute('lang', language);
		await expect(page.locator('html')).toHaveAttribute(
			'dir',
			language === 'he' ? 'rtl' : 'ltr'
		);
		await expect(page.locator('html')).toHaveAttribute(
			'data-theme',
			language === 'he' ? 'light' : 'dark'
		);
		await expect(page.getByTestId('pwa-refresh-error')).toHaveText(
			pwaMessages[language].cachedRefreshFailed
		);
		await expect(page.getByTestId('pwa-error-detail')).toBeVisible();
		await expect(page.getByTestId('pwa-error')).toBeVisible();
	}
	// Controls update the same component instance. Each variant must replace
	// the full fixture so a previous error cannot leak into Ready or setup failure.
	for (const state of ['ready', 'unavailable']) {
		await page.evaluate((state) => {
			(
				window as Window & {
					__STORYBOOK_ADDONS_CHANNEL__: {
						emit: (event: string, payload: unknown) => void;
					};
				}
			).__STORYBOOK_ADDONS_CHANNEL__.emit('updateStoryArgs', {
				storyId: 'components-pwastatus--cached-refresh-failure',
				updatedArgs: { state }
			});
		}, state);
		await expect(page.getByTestId('pwa-refresh-error')).toHaveCount(0);
		if (state === 'ready') {
			await expect(page.getByTestId('pwa-status')).toHaveAttribute(
				'data-state',
				'ready'
			);
			await expect(page.getByTestId('pwa-status-details')).toHaveCount(0);
		} else {
			await expect(page.getByTestId('pwa-incomplete')).toBeVisible();
			await expect(page.getByTestId('pwa-error-detail')).toHaveText(
				'Example offline setup failed: browser storage quota exceeded.'
			);
		}
	}
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
	for (const state of ['default', 'compact']) {
		await page.goto(storyUrl(`components-appfooter--${state}`));
		await expect(
			page.getByRole('combobox').locator('option:checked')
		).toHaveText('en');
		if (state === 'compact') {
			expect((await page.getByRole('button').boundingBox())!.height).toBe(36);
			expect((await page.getByRole('combobox').boundingBox())!.height).toBe(36);
		}
		await page.getByRole('button').click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
		await page.getByRole('combobox').selectOption({ label: 'עב' });
		await expect(
			page.getByRole('combobox').locator('option:checked')
		).toHaveText('עב');
	}
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
	await expect(
		page.getByRole('heading', { name: 'Add to your home screen' })
	).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Prepare for offline reading' })
	).toBeVisible();
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

test('PWA status has direct exceptional actions and always-visible details', async ({
	page
}) => {
	for (const state of ['initial', 'preparing', 'ready']) {
		const id = `components-pwastatus--${state}`;
		await page.goto(storyUrl(id));
		await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
			'data-story-rendered',
			id
		);
		await expect(page.getByTestId('pwa-status')).toHaveAttribute(
			'data-state',
			state === 'ready' ? 'ready' : 'preparing'
		);
		await expect(page.locator('details, summary')).toHaveCount(0);
		await expect(page.getByTestId('pwa-status-details')).toHaveCount(0);
		await expect(page.getByRole('status')).toHaveCSS('position', 'absolute');
		if (state === 'initial') await expect(page.getByRole('status')).toBeEmpty();
		else await expect(page.getByRole('status')).toContainText(/offline/i);
		expect(
			await page
				.getByTestId('pwa-preview-slot')
				.evaluate((el) => el.getBoundingClientRect().height)
		).toBe(0);
	}
	for (const [width, language, theme, direction] of [
		[320, 'he', 'light', 'rtl'],
		[390, 'en', 'dark', 'ltr']
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		for (const state of ['unavailable', 'outdated', 'update']) {
			await page.goto(
				`${storyUrl(`components-pwastatus--${state}`)}&globals=language:${language};theme:${theme};direction:${direction}`
			);
			const root = page.getByTestId('pwa-status');
			const detail = page.getByTestId('pwa-status-details');
			await expect(
				page.locator('details, summary, [role="dialog"]')
			).toHaveCount(0);
			await expect(detail).toBeVisible();
			await expect(detail).toHaveAttribute('id', 'offline-status');
			await expect(detail).toHaveCSS('position', 'static');
			const link = root.getByRole('link');
			await expect(link).toHaveCount(1);
			await expect(link).toHaveAccessibleName(/\S/);
			await expect(link).toHaveAttribute('href', '#offline-status');
			const panel = page.getByTestId(
				state === 'unavailable' ? 'pwa-incomplete' : 'pwa-update'
			);
			await expect(panel).toBeVisible();
			await expect(
				page.getByTestId(
					state === 'unavailable' ? 'pwa-update' : 'pwa-incomplete'
				)
			).toHaveCount(0);
			expect(
				await page
					.getByTestId('pwa-preview-slot')
					.evaluate((el) => el.getBoundingClientRect().height)
			).toBe(36);
			const bounds = await detail.boundingBox();
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
			if (state === 'unavailable') {
				await expect(page.getByTestId('pwa-error')).toHaveCount(1);
				await expect(page.getByTestId('pwa-update-link')).toHaveCount(0);
				await expect(page.getByTestId('pwa-error-detail')).toHaveText(
					'Example offline setup failed: browser storage quota exceeded.'
				);
				await expect(page.getByTestId('pwa-error-detail')).toHaveAttribute(
					'dir',
					'auto'
				);
				await expect(page.getByTestId('pwa-refresh-error')).toHaveCount(0);
				const retry = root.getByRole('button', { name: /^(Retry|נסו שוב)$/ });
				await expectCompactAction(retry);
				await retry.click();
				await expect(page.getByText('Retry requests: 1')).toBeVisible();
				await expect(panel).toBeVisible();
			} else {
				await expect(page.getByTestId('pwa-update-link')).toHaveCount(1);
				await expect(panel).toHaveText(pwaMessages[language].update);
				await expect(root.getByRole('button')).toHaveCount(0);
			}
			const before = page.url();
			await link.focus();
			await link.press('Enter');
			// SvelteKit's Storybook provider mocks anchors; this exact local target
			// focuses the visible section without permitting real app navigation.
			await expect(detail).toBeFocused();
			expect(page.url()).toBe(before);
			await expect(detail).toBeVisible();
			await expect(
				page.getByRole('button', { name: /^(Close|סגירה)$/ })
			).toHaveCount(0);
		}
	}
	expect(
		await page.evaluate(
			async () => (await navigator.serviceWorker.getRegistrations()).length
		)
	).toBe(0);
});

test('refresh failures preserve stored-data truth and one direct header error', async ({
	page
}) => {
	test.setTimeout(60_000);
	for (const [width, language, theme, direction] of [
		[320, 'he', 'light', 'rtl'],
		[390, 'en', 'dark', 'ltr']
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		const text = pwaMessages[language];
		for (const state of [
			'cached-refresh-failure',
			'update-refresh-failure',
			'cached-refresh-shell-unavailable'
		]) {
			await page.goto(
				`${storyUrl(`components-pwastatus--${state}`)}&globals=language:${language};theme:${theme};direction:${direction}`
			);
			const root = page.getByTestId('pwa-status');
			const detail = page.getByTestId('pwa-status-details');
			await expect(root).toHaveAttribute(
				'data-state',
				state === 'cached-refresh-shell-unavailable' ? 'error' : 'ready'
			);
			await expect(root).toHaveAttribute('data-refresh-state', 'error');
			await expect(
				page.locator('details, summary, [role="dialog"]')
			).toHaveCount(0);
			await expect(root.getByRole('link')).toHaveCount(1);
			await expect(root.getByRole('link')).toHaveAttribute(
				'href',
				'#offline-status'
			);
			await expect(page.getByTestId('pwa-error')).toHaveCount(1);
			await expect(page.getByTestId('pwa-update-link')).toHaveCount(0);
			await expect(page.getByTestId('pwa-refresh-error')).toHaveText(
				text.cachedRefreshFailed
			);
			await expect(page.getByTestId('pwa-refresh-error')).toBeVisible();
			await expect(page.getByTestId('pwa-error-detail')).toHaveText(
				'Example course refresh failed: response validation rejected missing course names.'
			);
			await expect(page.getByTestId('pwa-error-detail')).toHaveAttribute(
				'dir',
				'auto'
			);
			await expect(page.getByTestId('pwa-incomplete')).toHaveCount(0);
			await expect(page.getByTestId('pwa-update')).toHaveCount(
				state === 'update-refresh-failure' ? 1 : 0
			);
			if (state === 'update-refresh-failure')
				await expect(page.getByTestId('pwa-update')).toHaveText(text.update);
			expect(
				await page
					.getByTestId('pwa-preview-slot')
					.evaluate((el) => el.getBoundingClientRect().height)
			).toBe(36);
			const bounds = await detail.boundingBox();
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
			await page.screenshot({
				path: test.info().outputPath(`pwa-${state}-${width}.png`),
				fullPage: true
			});
			const retry = root.getByRole('button', { name: /^(Retry|נסו שוב)$/ });
			await expectCompactAction(retry);
			await retry.click();
			await expect(page.getByText('Retry requests: 1')).toBeVisible();
			// A retry request does not dismiss a real failure or hide a pending update.
			await expect(root).toHaveAttribute('data-refresh-state', 'error');
			await expect(page.getByTestId('pwa-refresh-error')).toBeVisible();
			await expect(page.getByTestId('pwa-update')).toHaveCount(
				state === 'update-refresh-failure' ? 1 : 0
			);
		}
	}
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
	await expect(page.getByTestId('plan-read-only')).toHaveCSS(
		'position',
		'absolute'
	);
	await expect(page.getByRole('button', { name: 'Try again' })).toBeDisabled();
	await expect(page.getByTestId('pwa-account-unavailable')).toBeVisible();
	for (const state of ['ready', 'offline']) {
		const id = `components-consoleaccountstatus--${state}`;
		await page.goto(storyUrl(id));
		await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
			'data-story-rendered',
			id
		);
		expect(
			await page
				.getByTestId('account-preview-slot')
				.evaluate((el) => el.getBoundingClientRect().height)
		).toBe(0);
		if (state === 'offline') {
			await expect(page.getByRole('status')).toContainText('Offline');
			await expect(page.getByRole('status')).toHaveCSS('position', 'absolute');
		}
	}
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
	await page.goto(storyUrl('pages-catalog--no-degree'));
	await expect(
		page.getByRole('link', { name: /Select degree/i })
	).toHaveAttribute('href', '/app/settings');
});

test('filters stay visible and retain committed values above search results', async ({
	page
}) => {
	await page.goto(storyUrl('components-searchfilters--selected'));
	await expect(page.locator('.search-filters')).toBeVisible();
	await expect(
		page.locator('details.search-filters, .search-filters summary')
	).toHaveCount(0);
	await expect(page.locator('#search-faculty')).toBeVisible();
	await expect(page.locator('#search-faculty')).toHaveValue('Example science');
	await expect(page.locator('#search-points-min-input')).toHaveValue('2.0');
	await page.getByRole('button', { name: 'Clear filters' }).click();
	await expect(page.locator('#search-faculty')).toHaveValue('');
	await expect(page.locator('#search-points-min-input')).toHaveValue('0.0');
	await expect(page.locator('#search-faculty')).toBeVisible();
	await page.goto(storyUrl('pages-search--results'));
	await expect(page.locator('#search-faculty')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(
		page.locator('details.search-filters, .search-filters summary')
	).toHaveCount(0);
	const positions = await page.evaluate(() => ({
		filtersBottom: document
			.querySelector('.search-filters')!
			.getBoundingClientRect().bottom,
		headingTop: document
			.querySelector('.search-heading')!
			.getBoundingClientRect().top,
		headingBottom: document
			.querySelector('.search-heading')!
			.getBoundingClientRect().bottom,
		firstResult: document
			.querySelector('.search-results > li')!
			.getBoundingClientRect().top
	}));
	expect(positions.filtersBottom).toBeLessThanOrEqual(positions.headingTop);
	expect(positions.headingBottom).toBeLessThanOrEqual(positions.firstResult);
});

test('console surfaces remain readable and usable at narrow and wide widths', async ({
	page
}) => {
	test.setTimeout(120_000);
	for (const [width, globals] of [
		[320, 'theme:light;language:he;direction:rtl'],
		[1180, 'theme:dark;language:en;direction:ltr']
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		for (const id of [
			'pages-settings--choose-degree',
			'pages-course--default',
			'pages-course--missing-details',
			'pages-search--results',
			'pages-search--filtered-results',
			'pages-catalog--default',
			'pages-shared-plan--default'
		]) {
			await test.step(`${id} at ${width}`, async () => {
				await page.goto(`${storyUrl(id)}&globals=${globals}`);
				await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
					'data-story-rendered',
					id,
					{ timeout: 15_000 }
				);
				await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
				const overflow = await page.evaluate(
					() =>
						document.documentElement.scrollWidth -
						document.documentElement.clientWidth
				);
				expect(overflow).toBeLessThanOrEqual(1);
				if (id.startsWith('pages-search--')) {
					await expect(page.locator('#search-faculty')).toBeVisible();
					await expect(page.locator('#search-points-min-input')).toBeVisible();
					await expect(
						page.locator('details.search-filters, .search-filters summary')
					).toHaveCount(0);
					const filters = await page.locator('.search-filters').boundingBox();
					const heading = await page.locator('.search-heading').boundingBox();
					expect(filters!.y + filters!.height).toBeLessThanOrEqual(heading!.y);
				}
				if (id === 'pages-course--default') {
					const description = page.locator('p.course-description');
					await expect(description).toHaveText('A fictional follow-up course.');
					await expect(description).toBeVisible();
					await expect(page.locator('details.course-description')).toHaveCount(
						0
					);
					const about = await description.boundingBox();
					const actions = await page
						.getByTestId('course-plan-actions')
						.boundingBox();
					expect(about!.y + about!.height).toBeLessThanOrEqual(actions!.y);
				}
				if (id === 'pages-course--missing-details')
					await expect(page.locator('.course-description')).toHaveCount(0);

				if (
					[
						'pages-search--results',
						'pages-catalog--default',
						'pages-shared-plan--default'
					].includes(id)
				) {
					await expectOriginalCardHierarchy(
						page.locator('.course-card').first()
					);
				}
				for (const button of await page.locator('button.ui-button').all()) {
					if (await button.isVisible()) await expectCompactAction(button);
				}
				const controls = page.locator(
					'select, [data-testid="course-plan-actions"] button, .search-filters input[type="number"], .search-filters button'
				);
				for (const control of await controls.all()) {
					if (!(await control.isVisible())) continue;
					const dimensions = await control.evaluate((el) => ({
						height: el.getBoundingClientRect().height,
						minHeight: parseFloat(getComputedStyle(el).minHeight),
						fontSize: parseFloat(getComputedStyle(el).fontSize),
						isInput: el.matches('input, select')
					}));
					expect(dimensions.height).toBeGreaterThanOrEqual(35.5);
					// Editable fields stay compact with 16px text; action buttons are checked above.
					expect(dimensions.minHeight).toBeLessThanOrEqual(36);
					if (dimensions.isInput)
						expect(dimensions.fontSize).toBeGreaterThanOrEqual(16);
				}
				await page.screenshot({
					path: test.info().outputPath(`${id}-${width}.png`),
					fullPage: true
				});
			});
		}
	}
});

test('catalog course rows fill the available canvas without page gutters or width caps', async ({
	page
}) => {
	for (const width of [320, 390, 1440]) {
		for (const direction of ['rtl', 'ltr']) {
			await page.setViewportSize({ width, height: 800 });
			await page.goto(
				`${storyUrl('pages-catalog--default')}&globals=language:${direction === 'rtl' ? 'he' : 'en'};direction:${direction};theme:${direction === 'rtl' ? 'light' : 'dark'}`
			);
			await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
				'data-story-rendered',
				'pages-catalog--default',
				{ timeout: 15_000 }
			);
			const root = page.locator('.catalog-page');
			await expect(root).toHaveCSS('padding-left', '0px');
			await expect(root).toHaveCSS('padding-right', '0px');
			await expect(root).toHaveCSS('max-width', 'none');
			const canvas = await page.locator('[data-story-ready]').boundingBox();
			const bounds = await root.boundingBox();
			expect(bounds!.x).toBeCloseTo(canvas!.x, 1);
			expect(bounds!.width).toBeCloseTo(canvas!.width, 1);
			const rows = root.locator('.course-row');
			expect(await rows.count()).toBeGreaterThan(0);
			for (const row of await rows.all()) {
				const box = await row.boundingBox();
				expect(box!.x).toBeCloseTo(bounds!.x, 1);
				expect(box!.width).toBeCloseTo(bounds!.width, 1);
				const first = await row.locator('.course-card').first().boundingBox();
				expect(
					direction === 'rtl' ? first!.x + first!.width : first!.x
				).toBeCloseTo(direction === 'rtl' ? box!.x + box!.width : box!.x, 1);
			}
			await expectOriginalCardHierarchy(
				rows.first().locator('.course-card').first()
			);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth - innerWidth
				)
			).toBeLessThanOrEqual(1);
			await page.screenshot({
				path: test.info().outputPath(`catalog-edge-${width}-${direction}.png`),
				fullPage: true
			});
		}
	}
});

test('course cards retain original metadata and inline name/code in compact states', async ({
	page
}) => {
	for (const direction of ['rtl', 'ltr']) {
		await page.setViewportSize({ width: 320, height: 800 });
		for (const state of ['default', 'compact', 'with-note', 'study-days']) {
			await page.goto(
				`${storyUrl(`components-courseelement--${state}`)}&globals=language:${direction === 'rtl' ? 'he' : 'en'};direction:${direction};theme:${direction === 'rtl' ? 'light' : 'dark'}`
			);
			const card = page.locator('.course-card');
			await expectOriginalCardHierarchy(card);
			await expect(card.locator('.course-median')).toContainText('86');
			await expect(card.locator('.course-points')).toContainText('4');
			if (state === 'with-note')
				await expect(card.locator('.course-meta .course-note')).toHaveText(
					'★ Example note'
				);
			if (state === 'study-days') {
				await expect(card.locator('.course-footer')).toBeVisible();
				const body = await card.locator('.course-body').boundingBox();
				const footer = await card.locator('.course-footer').boundingBox();
				expect(footer!.y).toBeGreaterThanOrEqual(body!.y + body!.height);
			}
		}
	}
});

test('course card body and requirement details are separate keyboard controls', async ({
	page
}) => {
	await page.goto(storyUrl('components-courseelement--interactive-warning'));
	const open = page.locator('.course-card button:not([aria-expanded])');
	const warning = page.getByRole('button', {
		name: 'Course requirement details'
	});
	await expect(warning).toHaveAttribute('aria-expanded', 'false');
	const warningBox = await warning.boundingBox();
	const cardBox = await page.locator('.course-card').boundingBox();
	expect(warningBox!.height).toBe(36);
	expect(warningBox!.width).toBeCloseTo(cardBox!.width, 1);
	expect(warningBox!.y).toBeGreaterThanOrEqual(
		(await open.boundingBox())!.y + (await open.boundingBox())!.height
	);
	await open.focus();
	await open.press('Enter');
	await expect(warning).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByText('Demo course opens: 0')).toBeVisible();
	await open.press('Enter');
	await expect(page.getByText('Demo course opens: 1')).toBeVisible();
	await warning.focus();
	await warning.press('Space');
	await expect(warning).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByText('Demo course opens: 1')).toBeVisible();
	await expect(
		page.locator('button button, button a, a button, a a')
	).toHaveCount(0);
});

test('compact planner rails show three full items and the next item at mobile widths', async ({
	page
}) => {
	for (const width of [320, 390]) {
		for (const direction of ['rtl', 'ltr']) {
			await page.setViewportSize({ width, height: 800 });
			const globals = `theme:${direction === 'rtl' ? 'light' : 'dark'};language:${direction === 'rtl' ? 'he' : 'en'};direction:${direction}`;
			await page.goto(
				`${storyUrl('pages-plan--long-plan')}&globals=${globals}`
			);
			await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
				'data-story-rendered',
				'pages-plan--long-plan',
				{ timeout: 15_000 }
			);
			const rails = [
				['wishlist-scroller', '[data-testid="plan-wishlist"] > [data-code]'],
				['semester-scroller', '[data-semester]']
			];
			for (const [rail, items] of rails) {
				await expectRailReadingEdge(page.getByTestId(rail), items, direction);
				await expect
					.poll(
						async () =>
							page.getByTestId(rail).evaluate((el, selector) => {
								const rail = el.getBoundingClientRect();
								const boxes = Array.from(
									el.querySelectorAll(selector),
									(item) => item.getBoundingClientRect()
								);
								return {
									full: boxes.filter(
										(box) =>
											box.left >= rail.left - 0.5 &&
											box.right <= rail.right + 0.5
									).length,
									peek: boxes.filter((box) => {
										const visible =
											Math.min(box.right, rail.right) -
											Math.max(box.left, rail.left);
										return visible >= 4 && visible < box.width - 1;
									}).length
								};
							}, items),
						{ message: `${rail} at ${width}px ${direction}` }
					)
					.toEqual({ full: 3, peek: 1 });
			}
			await expectOriginalCardHierarchy(
				page.getByTestId('plan-wishlist').locator('.course-card').first()
			);
			// Full-page capture resizes the viewport and can move transformed RTL rails.
			// Capture the real initial viewport before keyboard focus scrolls a semester.
			await page.screenshot({
				path: test.info().outputPath(`compact-plan-${width}-${direction}.png`),
				fullPage: false
			});
			for (const [rail, items] of rails)
				await expectRailReadingEdge(page.getByTestId(rail), items, direction);
			const exams = page.locator('.semester-exams');
			await expect(exams.locator('.study-days')).toBeVisible();
			await expect(exams.locator('.study-chip').first()).toBeVisible();
			await expect(
				page.locator('details.semester-exams, .semester-exams summary')
			).toHaveCount(0);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth - innerWidth
				)
			).toBeLessThanOrEqual(1);
		}
	}
});
