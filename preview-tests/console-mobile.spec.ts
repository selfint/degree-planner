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
	artificialDelay: string | null;
};

const test = base.extend<{ evidence: Evidence }>({
	evidence: [
		async ({ context, baseURL }, use, testInfo) => {
			const origin = new URL(baseURL!).origin;
			const evidence: Evidence = {
				checkpoints: [],
				publicPaths: [],
				artificialDelay: null
			};
			let blockedProviderRequests = 0;
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
					blockedProviderRequests++;
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
								blockedProviderRequests,
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
	await expect(page.getByTestId('pwa-ready')).toBeVisible({ timeout: 45_000 });
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await expect(page.getByTestId('pwa-update')).toHaveCount(0);
}

for (const language of ['en', 'he'] as const) {
	test(`${language}: landing controls survive native console entry and delayed public data`, async ({
		page,
		context,
		evidence
	}, testInfo) => {
		await page.goto('/');
		await expect(page.locator('.landing')).toBeVisible();
		const select = page.locator('footer select');
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
			evidence.checkpoints.push('visible-theme-correct-console-bootstrap');
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
		const logo = page.locator('header a').filter({
			has: page.locator('img[alt="Logo"]')
		});
		await expect(logo).toHaveAttribute('href', '/app/');
		const onlineTimeOrigin = await page.evaluate(() => performance.timeOrigin);
		await logo.click();
		await expect(page).toHaveURL(/\/app\/plan$/);
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(
			onlineTimeOrigin
		);
		evidence.checkpoints.push('online-logo-stays-in-console-without-reload');

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
		await expect(page.getByTestId('pwa-offline')).toBeVisible();
		await expect(page.getByTestId('plan-read-only')).toBeVisible();
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
		await logo.click();
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
		evidence.checkpoints.push(
			'offline-logo-and-back-forward-preserve-synthetic-guest'
		);

		await context.setOffline(false);
		await expect(page.getByTestId('pwa-offline')).toHaveCount(0);
		await expect(page.getByTestId('plan-read-only')).toHaveCount(0);
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

	test('install help opens and closes without changing route or preferences', async ({
		page,
		evidence
	}, testInfo) => {
		await page.goto('/en');
		await page
			.getByRole('link', { name: 'Get Started', exact: true })
			.first()
			.click();
		await ready(page);
		const route = page.url();
		const help = page.locator('footer details');
		await help.locator('summary').click();
		await expect(help).toHaveAttribute('open', '');
		await expect(help).toContainText('iPhone or iPad');
		await expect(help).toContainText('Add to Home Screen');
		await expect(help).toContainText(
			'Browser and installed-app storage may be separate'
		);
		await noHorizontalOverflow(page);
		await help.scrollIntoViewIfNeeded();
		await screenshot(page, testInfo, 'iphone-install-help');
		await help.locator('summary').click();
		await expect(help).not.toHaveAttribute('open', '');
		await expect(page).toHaveURL(route);
		expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('en');
		evidence.checkpoints.push('iphone-ua-install-help-and-dismissal');
	});
});
