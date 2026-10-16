import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';

// A proxy of the real production build lets us deliver a changed worker script
// without modifying build files or racing other Playwright tests.
let server: Server;
let origin: string;
let revision = 0;

// Other suites mock network responses and block service workers globally.
test.use({ serviceWorkers: 'allow' });

test.beforeAll(async () => {
	const worker = await readFile(
		'.svelte-kit/output/client/service-worker.js',
		'utf8'
	);
	server = createServer(async (request, response) => {
		try {
			if (request.url === '/service-worker.js') {
				response.writeHead(200, {
					'content-type': 'application/javascript',
					'cache-control': 'no-store'
				});
				response.end(`${worker}\n// Test deployment ${revision}\n`);
				return;
			}
			const upstream = await fetch(`http://localhost:4173${request.url}`);
			response.writeHead(upstream.status, {
				'content-type':
					upstream.headers.get('content-type') ?? 'application/octet-stream'
			});
			response.end(Buffer.from(await upstream.arrayBuffer()));
		} catch {
			response.writeHead(502);
			response.end();
		}
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string')
		throw new Error('Missing test server address');
	origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
	server?.closeAllConnections();
	await new Promise<void>((resolve) => server?.close(() => resolve()));
});

test.beforeEach(async ({ page }, testInfo) => {
	await page.addInitScript(
		(language) => {
			if (localStorage.getItem('userData')) return;
			localStorage.setItem('lang', language);
			localStorage.setItem('version', '4');
			localStorage.setItem(
				'userData',
				JSON.stringify({
					exemptions: [],
					degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
					path: 'CG00006246',
					semesters: [[], []],
					currentSemester: 0,
					wishlist: ['02340124', '02340141']
				})
			);
		},
		testInfo.title.includes('[he]') ? 'he' : 'en'
	);
});

async function ready(page: Page) {
	await page.goto(`${origin}/plan`);
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	await expect(page.getByTestId('pwa-ready')).toBeVisible({ timeout: 20000 });
}

test('manifest and correctly sized icons support installation', async ({
	page,
	request
}) => {
	await ready(page);
	const manifest = await (
		await request.get(`${origin}/manifest.webmanifest`)
	).json();
	expect(manifest).toMatchObject({
		id: '/',
		start_url: '/plan',
		scope: '/',
		display: 'standalone'
	});
	for (const icon of manifest.icons) {
		const size = Number(icon.sizes.split('x')[0]);
		expect(
			await page.evaluate(async (src) => {
				const image = new Image();
				image.src = src;
				await image.decode();
				return [image.naturalWidth, image.naturalHeight];
			}, icon.src)
		).toEqual([size, size]);
	}
	const cdp = await page.context().newCDPSession(page);
	const { installabilityErrors } = await cdp.send(
		'Page.getInstallabilityErrors'
	);
	expect(installabilityErrors).toEqual([]);
	await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
		'href',
		/\/icons\/icon-180\.png$/
	);
});

test('a never-visited course loads by client navigation offline and guest edits survive reload', async ({
	page,
	context
}) => {
	const courses = JSON.parse(await readFile('static/courseData.json', 'utf8'));
	const course = courses['02340124'];
	const requests: string[] = [];
	page.on('request', (request) =>
		requests.push(new URL(request.url()).pathname)
	);
	await ready(page);
	expect(requests).not.toContain('/course/02340124');
	expect(requests).not.toContain('/_courses/02340124');
	const timeOrigin = await page.evaluate(() => performance.timeOrigin);
	await context.setOffline(true);
	await page.locator('[data-code="02340124"]').click();
	await expect(page).toHaveURL(`${origin}/course/02340124`);
	await expect(page.locator('main')).toContainText(course.name);
	// The route JS was not loaded before disconnecting: navigation stays client-side.
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
	await page.reload();
	await expect(page.locator('main')).toContainText(course.name);
	await expect(page.getByTestId('pwa-offline')).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Plan', exact: true })
	).toBeVisible();
	await page.getByRole('button', { name: 'Plan', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() => JSON.parse(localStorage.getItem('userData')!).semesters[0]
			)
		)
		.toEqual(['02340124']);
	await page.goto(`${origin}/plan`);
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	await page.reload();
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	await expect(page.getByTestId('pwa-offline')).toBeVisible();
	await context.setOffline(false);
	await expect(page.getByTestId('pwa-offline')).toHaveCount(0);
});

test('updates wait without reloading unsaved plan edits or other tabs', async ({
	page,
	context
}) => {
	await ready(page);
	const otherTab = await context.newPage();
	await otherTab.goto(`${origin}/plan`);
	// Reorder the wishlist without saving to exercise actual in-memory draft state.
	const first = page.locator('[data-code="02340124"]');
	const second = page.locator('[data-code="02340141"]');
	await first.dragTo(second, { targetPosition: { x: 5, y: 5 } });
	await expect(
		page.getByRole('button', { name: 'Save', exact: true })
	).toBeVisible();
	const draftOrder = await page
		.locator('[data-code]')
		.evaluateAll((cards) =>
			cards.map((card) => card.getAttribute('data-code'))
		);
	const saved = await page.evaluate(() => localStorage.getItem('userData'));
	const timeOrigin = await page.evaluate(() => performance.timeOrigin);
	revision++;
	await page.evaluate(async () =>
		(await navigator.serviceWorker.getRegistration())!.update()
	);
	await expect(page.getByTestId('pwa-update')).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(
				async () =>
					(await navigator.serviceWorker.getRegistration())?.waiting?.state
			)
		)
		.toBe('installed');
	await expect(
		page.getByRole('button', { name: 'Save', exact: true })
	).toBeVisible();
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
	expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
		saved
	);
	expect(
		await page
			.locator('[data-code]')
			.evaluateAll((cards) =>
				cards.map((card) => card.getAttribute('data-code'))
			)
	).toEqual(draftOrder);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await page.close();
	// Keeping the second tab open must still prevent activation.
	expect(
		await otherTab.evaluate(
			async () =>
				(await navigator.serviceWorker.getRegistration())?.waiting?.state
		)
	).toBe('installed');
	await otherTab.close();
	const reopened = await context.newPage();
	await reopened.goto(`${origin}/plan`);
	await expect
		.poll(() =>
			reopened.evaluate(
				async () => !(await navigator.serviceWorker.getRegistration())?.waiting
			)
		)
		.toBe(true);
	await expect(reopened.locator('[data-code="02340124"]')).toBeVisible();
});

test('caches contain only public assets and do not delete unrelated storage', async ({
	page
}) => {
	await page.goto(`${origin}/offline`);
	await page.evaluate(async () => {
		await caches.open('another-app-cache');
	});
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await page.goto(`${origin}/plan?private=never-cache-this-query`);
	const cacheEntries = await page.evaluate(async () => {
		const entries: string[] = [];
		for (const name of await caches.keys()) {
			for (const request of await (await caches.open(name)).keys())
				entries.push(request.url);
		}
		return entries;
	});
	expect(cacheEntries.every((url) => url.startsWith(origin))).toBe(true);
	expect(
		cacheEntries.some((url) =>
			/\/(catalogs\.json|courseData(?:Stripped)?\.json|_courses\/|_catalogs\/)/.test(
				new URL(url).pathname
			)
		)
	).toBe(false);
	expect(
		cacheEntries.some(
			(url) =>
				/private=|googleapis|firebase/.test(url) ||
				new URL(url).pathname === '/plan'
		)
	).toBe(false);
	expect(await page.evaluate(() => caches.keys())).toContain(
		'another-app-cache'
	);
});

for (const language of ['en', 'he'] as const) {
	test(`first opening saves all courses before an unvisited offline deep link [${language}]`, async ({
		page,
		context
	}) => {
		await page.setViewportSize(
			language === 'he'
				? { width: 390, height: 844 }
				: { width: 1280, height: 800 }
		);
		const courses = JSON.parse(
			await readFile('static/courseData.json', 'utf8')
		);
		await page.goto(`${origin}/`);
		await expect(page.getByTestId('pwa-ready')).toBeVisible({ timeout: 20000 });
		await context.setOffline(true);
		await page.goto(`${origin}/course/02340141`);
		await expect(page.locator('main')).toContainText(courses['02340141'].name);
		await expect(page.getByTestId('pwa-offline')).toBeVisible();
		await page.reload();
		await expect(page.locator('main')).toContainText(courses['02340141'].name);
		await expect(page.getByTestId('pwa-ready')).toBeVisible();
	});
}

test('evicted shell assets remove readiness offline and are repaired on reconnect', async ({
	page,
	context
}) => {
	await ready(page);
	const deleted = await page.evaluate(async () => {
		const name = (await caches.keys()).find((name) =>
			name.startsWith('planit-shell-')
		)!;
		const cache = await caches.open(name);
		const asset = (await cache.keys()).find(
			(request) =>
				request.url.includes('/nodes/') && request.url.endsWith('.js')
		)!;
		await cache.delete(asset);
		return asset.url;
	});
	expect(deleted).toContain('/nodes/');
	await context.setOffline(true);
	await expect(page.getByTestId('pwa-incomplete')).toBeVisible();
	await expect(page.getByTestId('pwa-ready')).toHaveCount(0);
	await context.setOffline(false);
	await expect(page.getByTestId('pwa-ready')).toBeVisible({ timeout: 20000 });
	expect(
		await page.evaluate(async (url) => !!(await caches.match(url)), deleted)
	).toBe(true);
});

test('denied IDB leaves online use available without claiming offline setup succeeded', async ({
	page
}) => {
	await page.addInitScript(() => {
		const open = indexedDB.open.bind(indexedDB);
		indexedDB.open = (name, ...args) => {
			if (
				name === 'degree-planner-public-data' ||
				name === 'degree-planner-courses'
			)
				throw new DOMException('Denied for test', 'SecurityError');
			return open(name, ...args);
		};
	});
	await page.goto(`${origin}/plan`);
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await expect(page.getByTestId('pwa-incomplete')).toBeVisible();
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
});

test('signed-in offline users can read an unvisited course without exposing or editing a private plan', async ({
	page,
	context
}) => {
	await ready(page);
	const courses = JSON.parse(await readFile('static/courseData.json', 'utf8'));
	const source = await readFile('src/lib/firebase.svelte.ts', 'utf8');
	const apiKey = source.match(/apiKey: '([^']+)'/)![1];
	// Exercise the real SDK's persisted-user offline restoration, using only a
	// synthetic, non-authenticating user. Never contact auth or cloud storage.
	await context.route(
		/https:\/\/(?:identitytoolkit|securetoken|firestore)\.googleapis\.com\//,
		(route) => route.abort()
	);
	await context.setOffline(true);
	const guestPlan = await page.evaluate(() => localStorage.getItem('userData'));
	await page.evaluate((apiKey) => {
		localStorage.setItem(
			`firebase:authUser:${apiKey}:[DEFAULT]`,
			JSON.stringify({
				uid: 'synthetic-offline-pwa-test',
				emailVerified: false,
				isAnonymous: false,
				providerData: [],
				apiKey,
				appName: '[DEFAULT]',
				stsTokenManager: {
					accessToken: 'synthetic-test-only-not-a-real-token',
					refreshToken: 'synthetic-test-only-not-a-real-refresh-token',
					expirationTime: Date.now() + 3600000
				}
			})
		);
	}, apiKey);
	await page.goto(`${origin}/course/02340141`);
	await expect(page.locator('main')).toContainText(courses['02340141'].name);
	await expect(page.getByTestId('course-plan-unavailable')).toBeVisible();
	await expect(page.getByTestId('course-plan-actions')).toHaveCount(0);
	await expect(
		page.getByRole('button', { name: 'Plan', exact: true })
	).toHaveCount(0);
	await expect(
		page.getByRole('heading', { name: 'Applies to', exact: true })
	).toHaveCount(0);
	await page.reload();
	await expect(page.locator('main')).toContainText(courses['02340141'].name);
	await expect(page.getByTestId('course-plan-unavailable')).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
		guestPlan
	);
	// Prove the SDK actually restored a signed-in account, rather than silently
	// testing the guest path: private planner views remain explicitly blocked.
	await page.goto(`${origin}/plan`);
	await expect(page.getByTestId('pwa-account-unavailable')).toBeVisible();
	await expect(page.locator('main')).toBeHidden();
});
