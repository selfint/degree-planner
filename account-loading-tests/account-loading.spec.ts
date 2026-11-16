import { expect, test, type Page } from '@playwright/test';

// Synthetic account only. Hold each Firebase adapter read until the test
// explicitly resolves/rejects it; never contact a real account or cloud store.
const adapter = `
const listeners = new Set();
const reads = [];
const auth = {
 currentUser: {uid: 'synthetic-account'},
 onAuthStateChanged(fn) { listeners.add(fn); queueMicrotask(() => fn(auth.currentUser)); return () => listeners.delete(fn); },
 signOut() { window.accountFixture.auth(null); }
};
window.accountFixture = {
 reads,
 auth(uid) { auth.currentUser = uid ? {uid} : null; listeners.forEach(fn => fn(auth.currentUser)); },
 finish(index, fail = false) { const read = reads[index]; if (fail) read.reject(new Error('controlled failure')); else read.resolve({version:4, semesters:[[]], wishlist:[], exemptions:[], currentSemester:0}); }
};
export async function initFirebase() { return {auth}; }
export function buildFirebaseStorage() { return {read: () => new Promise((resolve,reject) => reads.push({resolve,reject})), write: async () => {throw new Error('Unexpected write');}}; }
export function subscribeFirebase() { return () => {}; }
export async function startOptionalAnalytics() {}
export async function signIn() {}
`;
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
	// Keep this reproduction entirely local, including optional analytics.
	await page.route('**/*', (route) =>
		new URL(route.request().url()).origin === 'http://localhost:5173'
			? route.continue()
			: route.abort()
	);
	const errors: string[] = [];
	pageErrors.set(page, errors);
	page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
	expect(
		pageErrors.get(page),
		'no uncaught errors during initial load or reload'
	).toEqual([]);
});
async function command(page: Page, script: string) {
	await page.evaluate(script);
}
async function waitForAccountRead(page: Page, phase: string) {
	// A document's load event does not await SvelteKit's client load/hydration.
	// Start UI assertions only once this document has issued the held account read.
	// Keep the normal 5s assertion budget for the actual loading/privacy behavior.
	const started = Date.now();
	const state = () =>
		page.evaluate(() => {
			const fixture = (
				window as unknown as {
					accountFixture?: { reads: unknown[] };
				}
			).accountFixture;
			return {
				fixturePresent: !!fixture,
				readCount: fixture?.reads.length ?? 0,
				bootStatus: document.querySelector(
					'#console-boot .console-loading__status'
				)?.textContent,
				bootVisible: !!document.getElementById('console-boot'),
				loadingPresent: !!document.querySelector(
					'[data-testid="account-loading"]'
				),
				readyState: document.readyState
			};
		});
	try {
		await expect
			.poll(async () => (await state()).readCount, {
				message: `${phase}: the new document starts its controlled account read`,
				timeout: 20_000
			})
			.toBe(1);
	} finally {
		console.info('Account bootstrap', phase, {
			elapsedMs: Date.now() - started,
			...(await state())
		});
	}
}
async function prepare(
	page: Page,
	lang = 'en',
	observeEntry: false | 'document' | 'landing' = false
) {
	let releaseAdapter = () => {};
	const adapterGate = new Promise<void>((resolve) => {
		releaseAdapter = resolve;
	});
	// Console-only diagnostics survive later suites clearing test-results.
	// Log same-origin paths, never response bodies or account contents.
	const pendingRequests = new Set<string>();
	const localPath = (url: string) => {
		const parsed = new URL(url);
		return parsed.origin === 'http://localhost:5173'
			? parsed.pathname
			: undefined;
	};
	page.on('request', (request) => {
		const path = localPath(request.url());
		if (path) pendingRequests.add(path);
	});
	page.on('requestfinished', (request) => {
		const path = localPath(request.url());
		if (path) pendingRequests.delete(path);
	});
	page.on('requestfailed', (request) => {
		const path = localPath(request.url());
		if (path) {
			pendingRequests.delete(path);
			console.info(
				'Account request failed',
				path,
				request.failure()?.errorText
			);
		}
	});
	page.on('pageerror', (error) =>
		console.info('Account page error', error.message)
	);
	page.on('console', (message) => {
		if (message.type() === 'error')
			console.info('Account console error', message.text());
	});
	page.on('close', () =>
		console.info('Account outstanding requests', [...pendingRequests])
	);
	await page.route('**/src/lib/firebase.svelte.ts*', async (route) => {
		if (observeEntry) await adapterGate;
		await route.fulfill({ contentType: 'text/javascript', body: adapter });
	});
	await page.route(
		/https:\/\/(?:[^/]*google[^/]*|[^/]*firebase[^/]*|[^/]*vercel[^/]*)\//,
		(route) => route.abort()
	);
	await page.addInitScript((lang) => {
		localStorage.setItem('lang', lang);
		localStorage.setItem('theme', 'dark');
		localStorage.setItem('version', '4');
		localStorage.setItem(
			'userData',
			JSON.stringify({
				version: 4,
				semesters: [['02340124']],
				wishlist: [],
				exemptions: [],
				currentSemester: 0
			})
		);
	}, lang);
	if (observeEntry === 'landing') {
		await page.goto('/');
		await page
			.locator('main')
			.getByRole('link', { name: 'Get Started', exact: true })
			.click();
		await expect(page.locator('#console-boot')).toBeVisible();
		releaseAdapter();
	} else {
		await page.goto('/app/plan', { waitUntil: 'commit' });
		if (observeEntry) {
			await expect(page.locator('#console-boot')).toBeVisible();
			releaseAdapter();
		}
	}
	await waitForAccountRead(page, `${lang} initial document`);
	await expect(
		page
			.getByTestId('account-loading')
			.or(page.getByTestId('console-ready-loading'))
	).toBeVisible();
}
async function pending(page: Page) {
	await expect(
		page
			.getByTestId('account-loading')
			.or(page.getByTestId('console-ready-loading'))
	).toBeVisible();
	await expect(page.getByTestId('pwa-account-unavailable')).toHaveCount(0);
	await expect(page.locator('main')).toBeHidden();
	const footer = await page.locator('footer').boundingBox();
	expect(footer!.y).toBeGreaterThan(600);
}
for (const lang of ['en', 'he']) {
	test(`${lang}: delayed account load and repeated reload preserve guest data and stable footer`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await prepare(page, lang);
		const guest = await page.evaluate(() => localStorage.getItem('userData'));
		for (let attempt = 0; attempt < 2; attempt++) {
			if (attempt) {
				await page.reload();
				await waitForAccountRead(page, `${lang} explicit reload`);
			}
			await pending(page);
			await page.waitForTimeout(2500);
			await pending(page);
			await command(page, 'window.accountFixture.finish(0)');
			await expect(page.getByTestId('account-loading')).toHaveCount(0);
			await expect(page.locator('main')).toBeVisible();
			await expect(page.getByTestId('pwa-account-unavailable')).toHaveCount(0);
			expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
				guest
			);
		}
		await page.locator('footer').scrollIntoViewIfNeeded();
		await expect(page.locator('.footer-author')).toHaveCSS(
			'font-weight',
			'500'
		);
		await expect(page.locator('.footer-report')).toHaveCSS(
			'text-decoration-line',
			'underline'
		);
		await page.waitForTimeout(1500);
	});
}
test('actual failure, retry, interrupted auth, stale success and stale failure', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await prepare(page);
	await command(page, 'window.accountFixture.finish(0, true)');
	await expect(page.getByTestId('pwa-account-unavailable')).toBeVisible();
	// The development server also exposes the PWA setup retry in the footer.
	// Exercise the account retry, not an unrelated button with the same label.
	await page
		.getByTestId('pwa-account-unavailable')
		.getByRole('button', { name: 'Try again', exact: true })
		.click();
	await pending(page);
	await command(page, "window.accountFixture.auth('second-account')");
	await command(page, 'window.accountFixture.finish(1)');
	await pending(page);
	await command(page, "window.accountFixture.auth('third-account')");
	await command(page, 'window.accountFixture.finish(2, true)');
	await pending(page);
	await command(page, 'window.accountFixture.finish(3)');
	await expect(page.locator('main')).toBeVisible();
	await command(page, "window.accountFixture.auth('fourth-account')");
	await pending(page);
	await command(page, 'window.accountFixture.auth(null)');
	await expect(page.locator('main')).toBeVisible();
	await command(page, 'window.accountFixture.finish(4, true)');
	await expect(page.locator('main')).toBeVisible();
	await expect(page.getByTestId('pwa-account-unavailable')).toHaveCount(0);
});

for (const entry of ['document', 'landing'] as const) {
	test(`${entry}: entry loader stays visible until the account is ready`, async ({
		page
	}) => {
		await prepare(page, 'en', entry);
		await expect(page.getByTestId('account-loading')).toHaveCount(0);
		await expect(page.getByTestId('console-ready-loading')).toBeVisible();
		await expect(page.locator('.console-shell')).toHaveAttribute('inert', '');
		await expect(page.locator('main')).toBeHidden();
		const timeOrigin = await page.evaluate(() => performance.timeOrigin);
		await command(page, 'window.accountFixture.finish(0)');
		await expect(page.locator('.console-loading')).toHaveCount(0);
		await expect(page.locator('main')).toBeVisible();
		await expect(page.locator('.console-shell')).not.toHaveAttribute('inert');
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
		for (const target of ['settings', 'plan']) {
			await page.locator(`header a[href="/app/${target}"]`).click();
			await expect(page).toHaveURL(`http://localhost:5173/app/${target}`);
			await expect(page.locator('.console-loading')).toHaveCount(0);
		}
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
		// Reconnect/account retries must not bring back the entry screen or remount
		// the page. A sentinel on main detects accidental replacement of its DOM.
		await page
			.locator('main')
			.evaluate((el) => el.setAttribute('data-retained', 'yes'));
		await command(page, "window.accountFixture.auth('next-account')");
		await expect(page.getByTestId('account-loading')).toBeVisible();
		await expect(page.locator('.console-loading')).toHaveCount(0);
		await page.context().setOffline(true);
		await expect(page.getByTestId('pwa-account-unavailable')).toBeVisible();
		await expect(page.locator('.console-loading')).toHaveCount(0);
		await page.context().setOffline(false);
		await expect
			.poll(() => page.evaluate('window.accountFixture.reads.length'))
			.toBe(3);
		await command(page, 'window.accountFixture.finish(2)');
		await expect(page.locator('main')).toBeVisible();
		await expect(page.locator('main')).toHaveAttribute('data-retained', 'yes');
	});
}

test('going offline during entry releases the loader into account recovery', async ({
	page
}) => {
	await prepare(page);
	await page.context().setOffline(true);
	await expect(page.getByTestId('console-ready-loading')).toHaveCount(0);
	await expect(page.getByTestId('pwa-account-unavailable')).toBeVisible();
	await expect(page.locator('main')).toBeHidden();
	await expect(page.locator('.console-shell')).not.toHaveAttribute('inert');
	await page
		.getByTestId('pwa-account-unavailable')
		.getByRole('button', { name: 'Sign out', exact: true })
		.click();
	await expect(page.locator('main')).toBeVisible();
	await expect(page.locator('.console-loading')).toHaveCount(0);
});

test('development never initializes telemetry, even with the old PostHog opt-in', async ({
	page
}) => {
	const attempts: string[] = [];
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (
			/vercel|posthog|google-analytics|googletagmanager|firebaseinstallations|^firebase\.googleapis/i.test(
				url.hostname
			) ||
			url.pathname.startsWith('/_vercel/')
		)
			attempts.push(url.origin + url.pathname);
	});
	// Use the real Firebase adapter: its optional analytics must also stay off.
	// The common route guard blocks every external endpoint before network access.
	await page.goto('/app/plan');
	await expect(page.locator('.console-shell')).toBeVisible({ timeout: 20000 });
	await expect(page.locator('.console-loading')).toHaveCount(0);
	await page.waitForTimeout(2200);
	expect(attempts).toEqual([]);
	await expect(
		page.locator('script[src*="vercel"], script[src*="googletagmanager"]')
	).toHaveCount(0);
	expect(
		await page.evaluate(() =>
			localStorage.getItem('planit.analytics.browser-id.v1')
		)
	).toBeNull();
});

for (const language of ['en', 'he'])
	test(`streamed bytes smoothly advance one mobile ${language} entry screen and cached reload does not wait for refresh`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 740 });
		await page.addInitScript(() => {
			const samples: {
				measured: boolean;
				animation: string;
				iterations: string;
				lines: number;
				paragraphs: number;
				overflow: boolean;
			}[] = [];
			Object.assign(window, { loadingSamples: samples });
			const sample = () => {
				const root = document.querySelector('.console-loading');
				if (root && root.getBoundingClientRect().height) {
					const track = root.querySelector('.console-loading__track')!;
					const status = root.querySelector('.console-loading__status')!;
					const style = getComputedStyle(track.firstElementChild!);
					const range = document.createRange();
					range.selectNodeContents(status);
					samples.push({
						measured: track.hasAttribute('aria-valuenow'),
						animation: style.animationName,
						iterations: style.animationIterationCount,
						paragraphs: root.querySelectorAll('p').length,
						overflow: status.scrollWidth > status.clientWidth,
						lines: new Set(
							[...range.getClientRects()].map((r) => Math.round(r.top))
						).size
					});
				}
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
			const original = window.fetch;
			let snapshotPath = '';
			window.fetch = async (...args) => {
				const response = await original(...args);
				const input = args[0];
				const path = new URL(
					input instanceof Request ? input.url : String(input),
					location.href
				).pathname;
				if (path === '/_data/manifest.json') {
					snapshotPath = (await response.clone().json())['/courseData.json']
						.url;
					return response;
				}
				if (path !== '/courseData.json' && path !== snapshotPath)
					return response;
				if (response.status === 304)
					return new Promise<Response>((resolve) => {
						(
							window as unknown as { finishCourseBytes: () => void }
						).finishCourseBytes = () => resolve(response);
					});
				if (!response.ok) return response;
				const bytes = new Uint8Array(await response.arrayBuffer());
				const halfway = Math.floor(bytes.length / 2);
				return new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(bytes.slice(0, Math.floor(halfway / 2)));
							(
								window as unknown as { advanceCourseBytes: () => void }
							).advanceCourseBytes = () =>
								controller.enqueue(
									bytes.slice(Math.floor(halfway / 2), halfway)
								);
							(
								window as unknown as { finishCourseBytes: () => void }
							).finishCourseBytes = () => {
								controller.enqueue(bytes.slice(halfway));
								controller.close();
							};
						}
					}),
					{ status: response.status, headers: response.headers }
				);
			};
		});
		const opening = prepare(page, language);
		await expect(page.locator('#console-boot-detail')).toContainText('%', {
			timeout: 20000
		});
		await expect(
			page.locator('#console-boot [role=progressbar]')
		).toHaveAttribute('aria-valuenow', /^(2[5-9])$/);
		await command(page, 'window.advanceCourseBytes()');
		await expect(
			page.locator('#console-boot [role=progressbar]')
		).toHaveAttribute('aria-valuenow', /^(5[0-9])$/);
		await expect(
			page.locator('#console-boot .console-loading__indicator')
		).toHaveCSS('transition-duration', '0.12s');
		await page.screenshot({ path: '/tmp/smooth-progress-local.png' });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(
			page.locator('#console-boot .console-loading__indicator')
		).toHaveCSS('transition-duration', '0s');
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await command(page, 'window.finishCourseBytes()');
		await opening;
		await expect(page.getByTestId('console-ready-loading')).toBeVisible();
		await expect(
			page.getByTestId('console-ready-loading').getByRole('progressbar')
		).toHaveAttribute('aria-valuenow', '100');
		await command(page, 'window.accountFixture.finish(0)');
		await expect(page.locator('.console-loading')).toHaveCount(0);
		const samples = await page.evaluate(
			() =>
				(
					window as unknown as {
						loadingSamples: {
							measured: boolean;
							animation: string;
							iterations: string;
							lines: number;
							paragraphs: number;
							overflow: boolean;
						}[];
					}
				).loadingSamples
		);
		expect(samples.some((s) => !s.measured)).toBe(true);
		const firstMeasured = samples.findIndex((s) => s.measured);
		expect(firstMeasured).toBeGreaterThan(-1);
		expect(
			samples
				.slice(firstMeasured)
				.every((s) => s.measured && s.animation === 'none')
		).toBe(true);
		expect(
			samples.every(
				(s) =>
					s.iterations !== 'infinite' &&
					s.paragraphs === 1 &&
					s.lines === 1 &&
					!s.overflow
			)
		).toBe(true);
		await page.reload();
		await waitForAccountRead(page, 'cached streamed reload');
		await command(page, 'window.accountFixture.finish(0)');
		await expect(page.locator('main')).toBeVisible();
		await expect(page.locator('.console-loading')).toHaveCount(0);
		await page.waitForFunction(
			() =>
				typeof (window as unknown as { finishCourseBytes?: () => void })
					.finishCourseBytes === 'function'
		);
		await command(page, 'window.finishCourseBytes()');
		await expect(page.locator('.console-loading')).toHaveCount(0);
	});
