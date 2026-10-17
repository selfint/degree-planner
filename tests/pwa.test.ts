import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';

// A proxy of the real production build lets us deliver a changed worker script
// without modifying build files or racing other Playwright tests.
let server: Server;
let origin: string;
let revision = 0;
let originDisconnected = false;
let serveLegacyWorker = false;
let denyConsoleShell = false;

// Other suites mock network responses and block service workers globally.
test.use({ serviceWorkers: 'allow' });

test.beforeAll(async () => {
	const worker = await readFile(
		'.svelte-kit/output/client/service-worker.js',
		'utf8'
	);
	server = createServer(async (request, response) => {
		if (originDisconnected) {
			request.socket.destroy();
			return;
		}
		try {
			if (denyConsoleShell && request.url === '/app/offline') {
				response.writeHead(503);
				response.end();
				return;
			}
			if (request.url === '/service-worker.js') {
				response.writeHead(200, {
					'content-type': 'application/javascript',
					'cache-control': 'no-store'
				});
				response.end(
					serveLegacyWorker
						? "self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));"
						: `${worker}\n// Test deployment ${revision}\n`
				);
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

test.afterEach(() => {
	originDisconnected = false;
	serveLegacyWorker = false;
	denyConsoleShell = false;
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
	await page.goto(`${origin}/app/plan`);
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	await expect(page.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready',
		{ timeout: 20000 }
	);
}

test('manifest and correctly sized icons support installation', async ({
	page,
	request
}) => {
	await ready(page);
	await expect(page.locator('footer').getByTestId('pwa-status')).toHaveCount(0);
	await expect(page.locator('footer details')).toHaveCount(0);
	await expect(page.getByTestId('pwa-downloading')).toHaveCount(0);
	expect(
		await page
			.getByTestId('pwa-status')
			.evaluate((node) => node.getBoundingClientRect().height)
	).toBe(0);
	for (const link of await page.locator('footer a').all()) {
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	}
	const manifest = await (
		await request.get(`${origin}/manifest.webmanifest`)
	).json();
	expect(manifest).toMatchObject({
		id: '/',
		start_url: '/app/',
		scope: '/app/',
		display: 'standalone'
	});
	// Pre-hydration branding is part of the installed shell, including cold reloads.
	const shellAssets = await page.evaluate(async () => {
		const names = (await caches.keys()).filter((name) =>
			name.startsWith('planit-console-shell-')
		);
		return (
			await Promise.all(
				names.map(async (name) =>
					(await (await caches.open(name)).keys()).map(
						(request) => new URL(request.url).pathname
					)
				)
			)
		).flat();
	});
	expect(shellAssets).toContain('/brand/planit-logo.webp');
	expect(shellAssets).toContain('/brand/planit-wordmark.svg');

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

test('a never-visited course loads offline while guest plan editing stays read-only', async ({
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
	expect(requests).not.toContain('/app/course/02340124');
	expect(requests).not.toContain('/_courses/02340124');
	const timeOrigin = await page.evaluate(() => performance.timeOrigin);
	await page.evaluate(() => {
		document.documentElement.dataset.consoleEntrySeen = 'false';
		new MutationObserver((records) => {
			for (const record of records)
				for (const node of record.addedNodes) {
					if (
						node instanceof Element &&
						(node.matches('[data-testid="console-entry-loading"]') ||
							node.querySelector('[data-testid="console-entry-loading"]'))
					)
						document.documentElement.dataset.consoleEntrySeen = 'true';
				}
		}).observe(document.body, { childList: true, subtree: true });
	});
	await context.setOffline(true);
	await page.locator('[data-code="02340124"]').click();
	await expect(page).toHaveURL(`${origin}/app/course/02340124`);
	await expect(page.locator('main')).toContainText(course.name);
	// The route JS was not loaded before disconnecting: navigation stays client-side.
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
	await expect(page.locator('html')).toHaveAttribute(
		'data-console-entry-seen',
		'false'
	);
	await page.reload();
	await expect(page.locator('main')).toContainText(course.name);
	await expect(page.getByTestId('plan-read-only')).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Plan', exact: true })
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Plan', exact: true })
	).toBeDisabled();
	await expect(page.getByTestId('plan-read-only')).toBeVisible();
	// Brand navigation stays inside the installed shell instead of opening the
	// uncached marketing landing. It must retain the current client document.
	const offlineTimeOrigin = await page.evaluate(() => performance.timeOrigin);
	const home = page.locator('header a').first();
	await expect(home).toHaveAttribute('href', '/app/');
	await home.click();
	await expect(page).toHaveURL(`${origin}/app/plan`);
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(
		offlineTimeOrigin
	);
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem('userData')!).semesters[0]
		)
	).toEqual([]);
	await page.goto(`${origin}/app/plan`);
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	await page.reload();
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	await expect(page.getByTestId('plan-read-only')).toBeVisible();
	await context.setOffline(false);
	await expect(page.getByTestId('plan-read-only')).toHaveCount(0);
});

test('updates wait without reloading unsaved plan edits or other tabs', async ({
	page,
	context
}) => {
	await ready(page);
	const otherTab = await context.newPage();
	await otherTab.goto(`${origin}/app/plan`);
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
	await reopened.goto(`${origin}/app/plan`);
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
	await page.goto(`${origin}/app/offline`);
	await page.evaluate(async () => {
		await caches.open('another-app-cache');
	});
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await page.goto(`${origin}/app/plan?private=never-cache-this-query`);
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
				new URL(url).pathname === '/app/plan'
		)
	).toBe(false);
	expect(await page.evaluate(() => caches.keys())).toContain(
		'another-app-cache'
	);
});

for (const language of ['en', 'he'] as const) {
	test(`first opening saves all courses before an unvisited offline deep link [${language}]`, async ({
		page,
		context,
		browserName
	}) => {
		await page.setViewportSize(
			language === 'he'
				? { width: 390, height: 844 }
				: { width: 1280, height: 800 }
		);
		const courses = JSON.parse(
			await readFile('static/courseData.json', 'utf8')
		);
		await page.goto(`${origin}/app/`);
		await expect(page.getByTestId('pwa-status')).toHaveAttribute(
			'data-state',
			'ready',
			{ timeout: 20000 }
		);
		await expect(page.getByTestId('pwa-update')).toHaveCount(0);
		if (browserName === 'webkit') {
			// Older Playwright WebKit rejects even cache-only SW responses under
			// setOffline (microsoft/playwright#42775). Disconnect the actual origin
			// instead; this tests network-failure fallback, not an iOS airplane mode.
			originDisconnected = true;
			server.closeAllConnections();
			await expect(fetch(`${origin}/offline-outage-probe`)).rejects.toThrow();
		} else await context.setOffline(true);
		const navigation = await page.goto(`${origin}/app/course/02340141`);
		expect(navigation?.fromServiceWorker()).toBe(true);
		await expect(page.locator('main')).toContainText(courses['02340141'].name);
		if (browserName !== 'webkit')
			await expect(page.getByTestId('plan-read-only')).toBeVisible();
		const reload = await page.reload();
		expect(reload?.fromServiceWorker()).toBe(true);
		await expect(page.locator('main')).toContainText(courses['02340141'].name);
		await expect(page.getByTestId('pwa-status')).toHaveAttribute(
			'data-state',
			'ready'
		);
	});
}

test('evicted shell assets remove readiness offline and are repaired on reconnect', async ({
	page,
	context
}) => {
	await ready(page);
	const deleted = await page.evaluate(async () => {
		const name = (await caches.keys()).find((name) =>
			name.startsWith('planit-console-shell-')
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
	await expect(page.getByTestId('pwa-status')).not.toHaveAttribute(
		'data-state',
		'ready'
	);
	await context.setOffline(false);
	await expect(page.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready',
		{ timeout: 20000 }
	);
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
	await page.goto(`${origin}/app/plan`);
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
	await page.goto(`${origin}/app/course/02340141`);
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
	await page.goto(`${origin}/app/plan`);
	await expect(page.getByTestId('pwa-account-unavailable')).toBeVisible();
	await expect(page.locator('main')).toBeHidden();
});

test('console scope upgrades legacy installed launches without clearing open-tab caches', async ({
	page,
	context
}) => {
	serveLegacyWorker = true;
	await page.goto(origin);
	await page.evaluate(async () => {
		await navigator.serviceWorker.register('/service-worker.js', {
			scope: '/'
		});
		await navigator.serviceWorker.ready;
		const cache = await caches.open('planit-shell-legacy-open-tab');
		await cache.put('/legacy-draft-support.js', new Response('legacy asset'));
	});
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	const oldTab = await context.newPage();
	await oldTab.goto(origin);
	const oldTime = await oldTab.evaluate(() => performance.timeOrigin);
	serveLegacyWorker = false;
	await ready(page);
	await expect
		.poll(() =>
			page.evaluate(async () =>
				(await navigator.serviceWorker.getRegistrations()).map(
					(r) => new URL(r.scope).pathname
				)
			)
		)
		.toEqual(['/', '/app/']);
	expect(
		await page.evaluate(async () =>
			(await caches.open('planit-shell-legacy-open-tab'))
				.match('/legacy-draft-support.js')
				.then(Boolean)
		)
	).toBe(true);
	expect(await oldTab.evaluate(() => performance.timeOrigin)).toBe(oldTime);
	await oldTab.close();
	await expect
		.poll(() =>
			page.evaluate(
				async () =>
					(await navigator.serviceWorker.getRegistrations()).find(
						(r) => new URL(r.scope).pathname === '/'
					)?.active?.scriptURL
			)
		)
		.toBe(`${origin}/legacy-service-worker.js`);
	await context.setOffline(true);
	await page.goto(`${origin}/plan?source=installed#legacy`);
	await expect(page).toHaveURL(`${origin}/app/plan?source=installed#legacy`);
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	await expect(page.getByTestId('plan-read-only')).toBeVisible();
});

test('disconnecting preserves the current draft but blocks saving and new drags until reconnect', async ({
	page,
	context
}) => {
	await ready(page);
	await page
		.locator('[data-code="02340124"]')
		.dragTo(page.locator('[data-code="02340141"]'), {
			targetPosition: { x: 5, y: 5 }
		});
	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save).toBeEnabled();
	const order = await page
		.locator('[data-code]')
		.evaluateAll((cards) =>
			cards.map((card) => card.getAttribute('data-code'))
		);
	const saved = await page.evaluate(() => localStorage.getItem('userData'));
	await context.setOffline(true);
	await expect(save).toBeDisabled();
	await expect(page.getByTestId('plan-read-only')).toBeVisible();
	await page
		.locator('[data-code="02340124"]')
		.dragTo(page.locator('[data-code="02340141"]'), {
			targetPosition: { x: 5, y: 5 }
		});
	expect(
		await page
			.locator('[data-code]')
			.evaluateAll((cards) =>
				cards.map((card) => card.getAttribute('data-code'))
			)
	).toEqual(order);
	expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
		saved
	);
	await context.setOffline(false);
	await expect(save).toBeEnabled();
	await save.click();
	await expect(save).toHaveCount(0);
	expect(await page.evaluate(() => localStorage.getItem('userData'))).not.toBe(
		saved
	);
});

test('a failed console shell install keeps the existing root registration', async ({
	page
}) => {
	test.setTimeout(60_000);
	serveLegacyWorker = true;
	await page.goto(origin);
	await page.evaluate(async () => {
		await navigator.serviceWorker.register('/service-worker.js', {
			scope: '/'
		});
		await navigator.serviceWorker.ready;
	});
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	serveLegacyWorker = false;
	denyConsoleShell = true;
	await page.goto(`${origin}/app/plan`);
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	await expect(page.getByTestId('pwa-incomplete')).toBeVisible({
		timeout: 35_000
	});
	const root = await page.evaluate(async () => {
		const registration = (
			await navigator.serviceWorker.getRegistrations()
		).find((r) => new URL(r.scope).pathname === '/');
		return {
			active: registration?.active?.scriptURL,
			waiting: registration?.waiting?.scriptURL
		};
	});
	expect(root).toEqual({
		active: `${origin}/service-worker.js`,
		waiting: undefined
	});
	await expect(page.getByTestId('pwa-status')).not.toHaveAttribute(
		'data-state',
		'ready'
	);
});

test('a failed public-data persistence keeps the existing root registration even when the shell is ready', async ({
	page
}) => {
	serveLegacyWorker = true;
	await page.goto(origin);
	await page.evaluate(async () => {
		await navigator.serviceWorker.register('/service-worker.js', {
			scope: '/'
		});
		await navigator.serviceWorker.ready;
	});
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	serveLegacyWorker = false;
	await page.addInitScript(() => {
		const original = indexedDB.open.bind(indexedDB);
		indexedDB.open = (name, ...args) => {
			if (name.startsWith('degree-planner-'))
				throw new DOMException('Test storage denied', 'QuotaExceededError');
			return original(name, ...args);
		};
	});
	await page.goto(`${origin}/app/plan`);
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	await expect(page.getByTestId('pwa-incomplete')).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(async () =>
				(await navigator.serviceWorker.getRegistrations()).some(
					(r) =>
						new URL(r.scope).pathname === '/app/' &&
						r.active?.state === 'activated'
				)
			)
		)
		.toBe(true);
	await page.waitForTimeout(1500);
	const root = await page.evaluate(async () => {
		const registration = (
			await navigator.serviceWorker.getRegistrations()
		).find((r) => new URL(r.scope).pathname === '/');
		return {
			active: registration?.active?.scriptURL,
			waiting: registration?.waiting?.scriptURL
		};
	});
	expect(root).toEqual({
		active: `${origin}/service-worker.js`,
		waiting: undefined
	});
	await expect(page.getByTestId('pwa-status')).not.toHaveAttribute(
		'data-state',
		'ready'
	);
});
