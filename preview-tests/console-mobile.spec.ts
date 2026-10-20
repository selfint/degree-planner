import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
	expect,
	test as base,
	type Page,
	type Request,
	type TestInfo
} from '@playwright/test';

function providerRequest(value: string) {
	const url = new URL(value);
	// Match provider hosts rather than an application chunk named firebase.*.js.
	return (
		/(?:firebase(?:app|installations|remoteconfig|settings)?\.|firestore\.|identitytoolkit\.|securetoken\.|google-analytics\.|googletagmanager\.|analytics\.google\.|vercel-insights\.|vercel-scripts\.|posthog\.)/i.test(
			url.hostname
		) ||
		/^\/(?:__\/auth\/|_vercel\/(?:insights|speed-insights)\/)/.test(
			url.pathname
		)
	);
}
const courseCode = '02340141';
const courseName = 'קומבינטוריקה למדעי המחשב';
const guest = {
	exemptions: [],
	degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
	path: 'CG00006246',
	semesters: [[], []],
	currentSemester: 0,
	wishlist: ['02340124', courseCode]
};

type Evidence = {
	checkpoints: string[];
	publicPaths: string[];
	providerRequestCount: number;
	artificialDelay: string | null;
};

const test = base.extend<{ evidence: Evidence }>({
	evidence: [
		async ({ context, baseURL }, use, testInfo) => {
			const origin = new URL(baseURL!).origin;
			const evidence: Evidence = {
				checkpoints: [],
				publicPaths: [],
				providerRequestCount: 0,
				artificialDelay: null
			};
			const byResourceType: Record<string, number> = {};
			const record = (request: Request) => {
				const url = new URL(request.url());
				const resource = request.resourceType();
				byResourceType[resource] = (byResourceType[resource] ?? 0) + 1;
				// Only public, same-origin paths. No queries, provider URLs, headers,
				// bodies, browser storage, account details or error-message contents.
				if (url.origin === origin && !providerRequest(url.href))
					evidence.publicPaths.push(url.pathname);
			};
			context.on('request', record);
			await context.route('**/*', async (route) => {
				if (providerRequest(route.request().url())) {
					evidence.providerRequestCount++;
					await route.abort();
				} else await route.continue();
			});
			try {
				await use(evidence);
			} finally {
				context.off('request', record);
				const path = testInfo.outputPath('preview-mobile-qa.json');
				await mkdir(dirname(path), { recursive: true });
				await writeFile(
					path,
					`${JSON.stringify(
						{
							schemaVersion: 1,
							test: testInfo.title,
							status: testInfo.status,
							previewOrigin: origin,
							expectedCommit: process.env.PREVIEW_HEAD_SHA ?? null,
							viewport: { width: 390, height: 844 },
							browser: 'Playwright Chromium mobile emulation',
							checkpoints: evidence.checkpoints,
							artificialDelay: evidence.artificialDelay,
							requests: {
								byResourceType,
								blockedProviderRequests: evidence.providerRequestCount,
								publicPaths: [...new Set(evidence.publicPaths)].sort()
							},
							limitations: [
								'Branch-alias preview; CI separately checks exact-commit Vercel status and current branch head before and after this run. Browser responses do not independently attest their commit.',
								'Fresh anonymous browser contexts and synthetic local guest plans only; no Google sign-in or account plan coverage.',
								'Mobile and iPhone user-agent emulation is not a physical iOS or installed-app test.',
								'No app, service-worker or public-data responses are replaced. Optional provider requests are aborted.',
								'Old-install update transitions remain covered by tests/pwa.test.ts using an explicit local production-build proxy.'
							]
						},
						null,
						2
					)}\n`
				);
				await testInfo.attach('preview-mobile-qa.json', {
					path,
					contentType: 'application/json'
				});
			}
		},
		{ auto: true }
	]
});

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
	const path = testInfo.outputPath(`mobile-${name}.png`);
	await page.screenshot({ path, animations: 'disabled' });
	await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function watchConsoleEntry(page: Page) {
	await page.evaluate(() => {
		document.documentElement.dataset.consoleEntrySeen = 'false';
		new MutationObserver((records) => {
			for (const record of records)
				for (const node of record.addedNodes) {
					if (
						node instanceof Element &&
						(node.matches('[data-testid="console-entry-loading"]') ||
							node.querySelector('[data-testid="console-entry-loading"]'))
					) {
						document.documentElement.dataset.consoleEntrySeen = 'true';
					}
				}
		}).observe(document.body, { childList: true, subtree: true });
	});
}

async function noHorizontalOverflow(page: Page) {
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth + 1
		)
	).toBe(true);
}

async function ready(page: Page) {
	await expect(page.locator('#console-boot')).toBeHidden({ timeout: 45_000 });
	await expect(page.locator('main')).toBeVisible();
	await expect(page.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready',
		{ timeout: 45_000 }
	);
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await consolePwaFooter(page);
}

async function consolePwaFooter(page: Page) {
	const footer = page.locator('footer');
	await expect(footer.getByTestId('pwa-footer-row')).toHaveCount(1);
	await expect(footer).toHaveCSS('border-top-width', '1px');
	await expect(footer.getByTestId('pwa-footer-row')).toHaveCSS(
		'border-top-width',
		'0px'
	);
	await expect(footer.getByTestId('pwa-status')).toHaveCount(1);
	await expect(page.locator('header [data-testid^="pwa-"]')).toHaveCount(0);
	await expect(
		footer.locator('[data-testid="landing-install-info"], details')
	).toHaveCount(0);
	await expect(page.getByTestId('pwa-install-help')).toHaveCount(0);
	await noHorizontalOverflow(page);
}

for (const language of ['en', 'he'] as const) {
	test(`${language}: landing controls survive native console entry and delayed public data`, async ({
		page,
		context,
		evidence
	}, testInfo) => {
		let releaseScripts!: () => void;
		const scriptsReady = new Promise<void>((resolve) => {
			releaseScripts = resolve;
		});
		const scriptPattern = /\/_app\/immutable\/.*\.js(?:\?.*)?$/;
		await page.route(scriptPattern, async (route) => {
			await scriptsReady;
			await route.continue();
		});
		const select = page.locator('footer select');
		try {
			await page.goto('/', { waitUntil: 'commit' });
			await expect(page.locator('.landing')).toBeVisible();
			// A native selection cannot be accepted before its persistence and
			// language handlers exist. Both preference controls share this contract.
			await expect(select).toBeDisabled();
			await expect(page.locator('footer button[aria-pressed]')).toBeDisabled();
		} finally {
			releaseScripts();
		}
		await expect(select).toBeEnabled();
		evidence.checkpoints.push('landing-preferences-wait-for-real-hydration');
		// Exercise both directions using the real footer control, not seeded prefs.
		await select.selectOption({ label: 'en' });
		if (language === 'he') await select.selectOption({ label: 'עב' });
		const theme = language === 'en' ? 'light' : 'dark';
		const toggle = page.locator('footer button[aria-pressed]');
		await toggle.click();
		if (theme === 'dark') await toggle.click();
		await expect(page.locator('.landing')).toHaveAttribute(
			'dir',
			language === 'he' ? 'rtl' : 'ltr'
		);
		await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
		await noHorizontalOverflow(page);
		expect(
			await page.evaluate(
				async () => (await navigator.serviceWorker.getRegistrations()).length
			)
		).toBe(0);
		await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
		evidence.checkpoints.push('landing-language-and-theme-controls');
		await page.evaluate(() => scrollTo(0, 0));
		await screenshot(page, testInfo, `landing-${language}-${theme}`);

		let release!: () => void;
		let dataRequested = false;
		const released = new Promise<void>((resolve) => (release = resolve));
		evidence.artificialDelay =
			'Real courseData.json request is paused until boot-screen assertions finish, then continued unchanged. This is a loading-state check, not a performance measurement.';
		await page.route('**/courseData.json', async (route) => {
			dataRequested = true;
			await released;
			await route.continue();
		});
		try {
			await page
				.getByRole('link', {
					name: language === 'he' ? 'התחל' : 'Get Started',
					exact: true
				})
				.first()
				.click({ noWaitAfter: true });
			await expect.poll(() => dataRequested).toBe(true);
			await expect(page.locator('#console-boot')).toBeVisible();
			await expect(page.locator('#console-boot-detail')).toHaveText(
				language === 'he' ? 'טוענים קורסים…' : 'Loading courses…'
			);
			await expect(page.locator('#console-boot')).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(248, 250, 252)' : 'rgb(25, 25, 29)'
			);
			await expect(page.locator('#console-boot-logo')).toBeVisible();
			await expect
				.poll(() =>
					page
						.locator('#console-boot-logo')
						.evaluate((image) => (image as HTMLImageElement).naturalWidth)
				)
				.toBeGreaterThan(0);
			await expect(
				page.locator('#console-boot').getByRole('heading')
			).toHaveCount(0);
			await expect(
				page.locator('#console-boot .console-loading__track')
			).toBeVisible();
			evidence.checkpoints.push(
				'visible-theme-correct-branded-console-bootstrap'
			);
			await screenshot(page, testInfo, `loading-${language}-${theme}`);
		} finally {
			release();
		}
		await expect(page).toHaveURL(/\/app\/settings$/);
		await ready(page);
		await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
		await expect(page.locator('main').locator('..')).toHaveAttribute(
			'dir',
			language === 'he' ? 'rtl' : 'ltr'
		);
		expect(
			await page.evaluate(() => ({
				language: localStorage.getItem('lang'),
				theme: localStorage.getItem('theme')
			}))
		).toEqual({ language, theme });
		await noHorizontalOverflow(page);
		evidence.checkpoints.push('console-preferences-and-real-offline-readiness');
		await page.evaluate(() => scrollTo(0, 0));
		await screenshot(page, testInfo, `settings-${language}-${theme}`);
		await page.locator('footer').scrollIntoViewIfNeeded();
		await screenshot(page, testInfo, `console-footer-${language}-${theme}`);
		// The context belongs only to this test; no state carries into the journeys.
		expect(context.pages()).toHaveLength(1);
	});

	test(`${language}: cold offline course, console logo, history and guest reconnect`, async ({
		page,
		context,
		baseURL,
		evidence
	}, testInfo) => {
		await page.addInitScript(
			({ origin, language, guest }) => {
				if (location.origin !== origin || localStorage.getItem('userData'))
					return;
				localStorage.setItem('lang', language);
				localStorage.setItem('version', '4');
				localStorage.setItem('userData', JSON.stringify(guest));
			},
			{ origin: new URL(baseURL!).origin, language, guest }
		);
		await page.goto('/app/plan');
		await ready(page);
		await expect(page.locator(`[data-code="${courseCode}"]`)).toBeVisible();
		await noHorizontalOverflow(page);
		await screenshot(page, testInfo, `console-ready-${language}`);
		const logo = page
			.locator('header')
			.getByRole('link', { name: 'PlanIt', exact: true });
		await expect(logo).toHaveAttribute('href', '/');
		const initialTimeOrigin = await page.evaluate(() => performance.timeOrigin);
		const initialSavedPlan = await page.evaluate(() =>
			localStorage.getItem('userData')
		);
		await logo.click();
		await expect(page).toHaveURL(new URL('/', baseURL).href);
		await expect(page.locator('.landing')).toHaveAttribute(
			'dir',
			language === 'he' ? 'rtl' : 'ltr'
		);
		expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(
			initialTimeOrigin
		);
		await page.locator('header a[href="/app/"]').click();
		await expect(page).toHaveURL(/\/app\/plan$/);
		await ready(page);
		expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
			initialSavedPlan
		);
		const onlineTimeOrigin = await page.evaluate(() => performance.timeOrigin);
		evidence.checkpoints.push(
			'brand-opens-landing-and-get-started-restores-saved-plan'
		);

		await watchConsoleEntry(page);
		for (const target of ['catalog', 'settings', 'plan']) {
			await page.locator(`header a[href="/app/${target}"]`).click();
			await expect(page).toHaveURL(new URL(`/app/${target}`, baseURL).href);
			await expect(page.locator('main')).toBeVisible();
			await noHorizontalOverflow(page);
			await page.evaluate(() => scrollTo(0, 0));
			await screenshot(page, testInfo, `${target}-${language}`);
		}
		const search = page.locator('header input[type="text"]');
		await search.fill(courseCode);
		await search.press('Enter');
		await expect(page).toHaveURL(
			new URL(`/app/search?q=${courseCode}`, baseURL).href
		);
		await expect(page.locator('main')).toContainText(courseName);
		await noHorizontalOverflow(page);
		await screenshot(page, testInfo, `search-${language}`);
		await page.locator('header a[href="/app/plan"]').click();
		await expect(page.locator(`[data-code="${courseCode}"]`)).toBeVisible();
		await expect(page.locator('html')).toHaveAttribute(
			'data-console-entry-seen',
			'false'
		);
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(
			onlineTimeOrigin
		);
		evidence.checkpoints.push(
			'polished-console-routes-without-startup-overlay-or-reload'
		);

		const coursePath = `/app/course/${courseCode}`;
		expect(evidence.publicPaths).not.toContain(coursePath);
		expect(evidence.publicPaths).not.toContain(`/_courses/${courseCode}`);
		const savedGuest = await page.evaluate(() =>
			localStorage.getItem('userData')
		);
		await context.setOffline(true);
		const navigation = await page.goto(coursePath);
		expect(navigation?.fromServiceWorker()).toBe(true);
		await expect(page.locator('main h1')).toContainText(courseName);
		const reload = await page.reload();
		expect(reload?.fromServiceWorker()).toBe(true);
		await expect(page.locator('main h1')).toContainText(courseName);
		await expect(page.getByTestId('plan-read-only')).toBeVisible();
		await consolePwaFooter(page);
		const action = page.getByRole('button', {
			name: language === 'he' ? 'הוספה' : 'Plan',
			exact: true
		});
		await expect(action).toBeDisabled();
		await noHorizontalOverflow(page);
		evidence.checkpoints.push(
			'unvisited-offline-document-and-reload-from-real-worker'
		);
		await screenshot(page, testInfo, `offline-course-${language}`);

		const offlineTimeOrigin = await page.evaluate(() => performance.timeOrigin);
		await watchConsoleEntry(page);
		await page.locator('header nav a[href="/app/plan"]').click();
		await expect(page).toHaveURL(/\/app\/plan$/);
		await expect(page.locator(`[data-code="${courseCode}"]`)).toBeVisible();
		await page.goBack();
		await expect(page).toHaveURL(new URL(coursePath, baseURL).href);
		await expect(page.locator('main h1')).toContainText(courseName);
		await page.goForward();
		await expect(page).toHaveURL(/\/app\/plan$/);
		await page.goBack();
		await expect(page).toHaveURL(new URL(coursePath, baseURL).href);
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(
			offlineTimeOrigin
		);
		expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
			savedGuest
		);
		await expect(page.locator('html')).toHaveAttribute(
			'data-console-entry-seen',
			'false'
		);
		evidence.checkpoints.push(
			'offline-plan-navigation-and-back-forward-preserve-synthetic-guest-without-startup-overlay'
		);

		await context.setOffline(false);
		await expect(page.getByTestId('plan-read-only')).toHaveCount(0);
		await consolePwaFooter(page);
		await expect(action).toBeEnabled();
		// A real local guest-only write proves reconnect re-enables the action.
		await action.click();
		await expect
			.poll(() =>
				page.evaluate(
					(code) =>
						JSON.parse(localStorage.getItem('userData')!).semesters[0].includes(
							code
						),
					courseCode
				)
			)
			.toBe(true);
		await page.reload();
		await expect(page.locator('main h1')).toContainText(courseName);
		expect(
			await page.evaluate(
				(code) =>
					JSON.parse(localStorage.getItem('userData')!).semesters[0].includes(
						code
					),
				courseCode
			)
		).toBe(true);
		evidence.checkpoints.push(
			'reconnect-enables-local-guest-write-and-reload-persistence'
		);
	});
}

test.describe('iPhone-user-agent install guidance (Chromium emulation only)', () => {
	test.use({
		userAgent:
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
	});

	test('landing install guidance stays lightweight and is not repeated in the console footer', async ({
		page,
		evidence
	}, testInfo) => {
		await page.goto('/en');
		await expect(page.locator('.landing')).toHaveAttribute('dir', 'ltr');
		const route = page.url();
		const info = page.getByTestId('landing-install-info');
		await expect(info).toBeVisible();
		const help = info;
		await expect(info.locator('details, summary')).toHaveCount(0);
		await expect(help).toContainText('iPhone or iPad');
		await expect(help).toContainText('Add to Home Screen');
		await expect(help).toContainText(
			'Browser and installed-app storage may be separate'
		);
		await noHorizontalOverflow(page);
		await help.scrollIntoViewIfNeeded();
		await screenshot(page, testInfo, 'iphone-install-help');
		await expect(page).toHaveURL(route);
		expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('en');
		// Include the console's 1500ms optional-provider delay in the observation
		// window, so static guidance cannot accidentally start console services.
		await page.waitForTimeout(1800);
		expect(evidence.providerRequestCount).toBe(0);
		expect(
			evidence.publicPaths.filter((path) =>
				/^\/(?:app(?:\/|$)|catalogs\.json$|courseData(?:Stripped)?\.json$|_courses\/|_catalogs\/|service-worker\.js$|manifest\.webmanifest$)/.test(
					path
				)
			)
		).toEqual([]);
		expect(
			await page.evaluate(
				async () => (await navigator.serviceWorker.getRegistrations()).length
			)
		).toBe(0);
		await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
		await expect(page.getByTestId('pwa-status')).toHaveCount(0);
		evidence.checkpoints.push(
			'iphone-ua-landing-help-without-console-bootstrap'
		);
		await page
			.getByRole('link', { name: 'Get Started', exact: true })
			.first()
			.click();
		await ready(page);
		await expect(info).toHaveCount(0);
		evidence.checkpoints.push(
			'console-pwa-controls-contained-in-dedicated-footer-row'
		);
		await expect(page.getByTestId('pwa-install-help')).toHaveCount(0);
		await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
		evidence.checkpoints.push(
			'healthy-console-has-no-install-help-or-update-notice'
		);
	});
});
