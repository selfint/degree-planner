import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { pwaMessages } from '../src/lib/pwa/messages';
import { createPwaDeployment } from './helpers/pwa-deployment';

async function viewOfflineError(page: Page, timeout = 15000) {
	const error = page.getByTestId('pwa-error');
	await expect(error).toBeVisible({ timeout });
	await expect(error.locator('details, summary')).toHaveCount(0);
	await error
		.getByRole('button', { name: /error details|פרטי שגיאה/i })
		.click();
	await expect(page.getByTestId('pwa-status-details')).toBeVisible();
}

// Proxy the real build as distinct deployments, including disjoint immutable
// asset URLs. Only the current deployment is available from the network; old
// tabs must really use their cached scripts after deployment/activation.
// Native workers install, wait, cache and activate without lifecycle mocks.
let server: Server;
let origin: string;
let revision = 1;
let buildVersion: string;
let immutablePaths: string[];
const deployments = new Map<number, ReturnType<typeof createPwaDeployment>>();
function deployment() {
	let current = deployments.get(revision);
	if (!current) {
		current = createPwaDeployment(buildVersion, revision, immutablePaths);
		deployments.set(revision, current);
	}
	return current;
}
const deploymentVersion = () => deployment().version;
let originDisconnected = false;
let serveLegacyWorker = false;
let denyConsoleShell = false;
let denyWorkerUpdate = false;

// Other suites mock network responses and block service workers globally.
test.use({ serviceWorkers: 'allow' });

test.beforeAll(async () => {
	const worker = await readFile(
		'.svelte-kit/output/client/service-worker.js',
		'utf8'
	);
	const manifest = JSON.parse(
		await readFile('.svelte-kit/output/client/_app/version.json', 'utf8')
	);
	if (
		typeof manifest.version !== 'string' ||
		!/^[\w.-]+$/.test(manifest.version)
	)
		throw new Error('Production build version must be a nonempty safe string');
	buildVersion = manifest.version;
	immutablePaths = (
		await readdir('.svelte-kit/output/client/_app/immutable', {
			recursive: true,
			withFileTypes: true
		})
	)
		.filter((entry) => entry.isFile())
		.map((entry) => {
			const path = `${entry.parentPath}/${entry.name}`.replaceAll('\\', '/');
			return path.slice(path.indexOf('/_app/immutable/'));
		});
	if (!worker.includes(JSON.stringify(buildVersion)))
		throw new Error(
			'Expected the exact compiled build-version literal in the production worker'
		);
	server = createServer(async (request, response) => {
		if (originDisconnected) {
			request.socket.destroy();
			return;
		}
		try {
			// Snapshot the deployment at request arrival. An in-flight upstream
			// response must not acquire the next revision's imports halfway through.
			const current = deployment();
			const url = new URL(request.url ?? '/', origin);
			const path = url.pathname;
			if (denyConsoleShell && request.url === '/app/offline') {
				response.writeHead(503);
				response.end();
				return;
			}
			if (request.url === '/service-worker.js' && denyWorkerUpdate) {
				response.writeHead(503, { 'cache-control': 'no-store' });
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
						: current.rewrite(worker)
				);
				return;
			}
			const immutable = path.startsWith('/_app/immutable/');
			const originalPath = immutable ? current.networkAssets.get(path) : path;
			// In particular, never let Vite's preview fallback serve the previous
			// deployment or the build's original immutable paths.
			if (!originalPath) {
				response.writeHead(404, { 'cache-control': 'no-store' });
				response.end('This immutable asset is no longer deployed');
				return;
			}
			const upstream = await fetch(
				`http://localhost:4173${originalPath}${url.search}`
			);
			const contentType =
				upstream.headers.get('content-type') ?? 'application/octet-stream';
			response.writeHead(upstream.status, {
				'content-type': contentType,
				'cache-control': immutable
					? 'public, max-age=31536000, immutable'
					: 'no-cache'
			});
			const body = Buffer.from(await upstream.arrayBuffer());
			response.end(
				/\.(?:m?js|css)$/.test(path) ||
					path === '/_app/version.json' ||
					contentType.includes('text/html')
					? current.rewrite(body.toString('utf8'))
					: body
			);
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
	denyWorkerUpdate = false;
	revision = 1;
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

async function moveWishlistCourse(page: Page, code: string, semester: number) {
	const destination = page.locator(`[data-semester="${semester}"]`);
	const bounds = (await destination.boundingBox())!;
	const position = { x: bounds.width / 2, y: 24 };
	await page
		.getByTestId('plan-wishlist')
		.locator(`[data-code="${code}"]`)
		.hover();
	await page.mouse.down();
	try {
		// WebKit requires a second native dragover before mouseup.
		await destination.hover({ position });
		await destination.hover({ position });
	} finally {
		await page.mouse.up();
	}
	await expect(destination.locator(`[data-code="${code}"]`)).toHaveCount(1);
	await expect(
		page.getByRole('button', { name: 'Save', exact: true })
	).toBeVisible();
}

async function expectUpdateBanner(
	page: Page,
	version: string,
	language: 'en' | 'he' = 'en'
) {
	const banner = page.getByTestId('pwa-update-banner');
	await expect(banner).toHaveCount(1);
	await expect(banner).toBeVisible();
	await expect(banner.getByTestId('pwa-update')).toHaveText(
		pwaMessages[language].update
	);
	await expect(banner.getByTestId('pwa-update')).toHaveAttribute(
		'role',
		'status'
	);
	await expect(banner).toHaveAttribute('data-update-version', version);
	await expect(banner.locator('a, details, summary')).toHaveCount(0);
	await expect(banner.getByRole('button')).toHaveCount(2);
	await expect(banner.getByTestId('pwa-update-accept')).toHaveAccessibleName(
		pwaMessages[language].updateAccept
	);
	await expect(banner.getByTestId('pwa-update-dismiss')).toHaveAccessibleName(
		pwaMessages[language].close
	);
	await expect(banner.getByTestId('pwa-update-dismiss')).toBeEnabled();
	await expect(page.getByTestId('pwa-update-link')).toHaveCount(0);
	await expect(page.locator('footer').getByTestId('pwa-update')).toHaveCount(0);
	await expect(
		page.locator('header').getByTestId('pwa-update-banner')
	).toHaveCount(0);
	const placement = await banner.evaluate((element) => {
		const header = document.querySelector('header')!;
		const main = document.querySelector('main')!;
		const bounds = element.getBoundingClientRect();
		return {
			afterHeader: !!(
				header.compareDocumentPosition(element) &
				Node.DOCUMENT_POSITION_FOLLOWING
			),
			beforeMain: !!(
				element.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING
			),
			top: bounds.top,
			bottom: bounds.bottom,
			headerBottom: header.getBoundingClientRect().bottom,
			mainTop: main.getBoundingClientRect().top
		};
	});
	expect(placement.afterHeader).toBe(true);
	expect(placement.beforeMain).toBe(true);
	expect(placement.top).toBeGreaterThanOrEqual(placement.headerBottom);
	expect(placement.bottom).toBeLessThanOrEqual(placement.mainTop);
}

async function workerVersion(
	page: Page,
	target: 'active' | 'waiting' | 'controller'
) {
	return page.evaluate(async (target) => {
		const registration = await navigator.serviceWorker.getRegistration();
		const worker =
			target === 'controller'
				? navigator.serviceWorker.controller
				: registration?.[target];
		if (!worker) return null;
		const channel = new MessageChannel();
		try {
			return await new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error('Worker version response timed out')),
					5000
				);
				channel.port1.onmessage = ({ data }) => {
					clearTimeout(timeout);
					if (
						data?.type === 'OFFLINE_SHELL_VERSION' &&
						typeof data.version === 'string' &&
						data.version
					)
						resolve(data.version);
					else reject(new Error('Invalid worker version response'));
				};
				worker.postMessage({ type: 'GET_OFFLINE_SHELL_VERSION' }, [
					channel.port2
				]);
			});
		} finally {
			channel.port1.close();
			channel.port2.close();
		}
	}, target);
}

async function storedCourses(page: Page) {
	return page.evaluate(async () => {
		const snapshot = await new Promise<{
			courses: unknown[];
			count: number;
			schemaVersion: number;
		}>((resolve, reject) => {
			const request = indexedDB.open('degree-planner-courses', 1);
			request.onupgradeneeded = () => request.transaction?.abort();
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const database = request.result;
				try {
					const transaction = database.transaction(
						['courses', 'meta'],
						'readonly'
					);
					const courses = transaction.objectStore('courses').getAll();
					const metadata = transaction.objectStore('meta').get('courses');
					transaction.oncomplete = () => {
						database.close();
						resolve({
							courses: courses.result,
							count: metadata.result.count,
							schemaVersion: metadata.result.schemaVersion
						});
					};
					transaction.onabort = () => {
						database.close();
						reject(transaction.error);
					};
				} catch (error) {
					database.close();
					reject(error);
				}
			};
		});
		// Compare every durable course field, while permitting honest refresh-time
		// metadata to advance. IndexedDB getAll is ordered by its real primary key.
		const digest = await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(JSON.stringify(snapshot.courses))
		);
		return {
			records: snapshot.courses.length,
			count: snapshot.count,
			schemaVersion: snapshot.schemaVersion,
			digest: Array.from(new Uint8Array(digest), (byte) =>
				byte.toString(16).padStart(2, '0')
			).join('')
		};
	});
}

test('manifest and correctly sized icons support installation', async ({
	page,
	request
}) => {
	// Observe the genuine first-install lifecycle, including transient DOM frames.
	await page.addInitScript(() => {
		new MutationObserver((records) => {
			for (const record of records)
				for (const node of record.addedNodes) {
					if (
						node instanceof Element &&
						(node.matches('[data-testid="pwa-update-banner"]') ||
							node.querySelector('[data-testid="pwa-update-banner"]'))
					)
						document.documentElement.dataset.initialUpdateBannerSeen = 'true';
				}
		}).observe(document, { childList: true, subtree: true });
	});
	await ready(page);
	await expect(page.locator('html')).not.toHaveAttribute(
		'data-initial-update-banner-seen',
		'true'
	);
	await expect(page.locator('header').getByTestId('pwa-status')).toHaveCount(0);
	await expect(page.locator('footer').getByTestId('pwa-status')).toHaveCount(1);
	await expect(
		page.locator('footer').getByTestId('pwa-footer-row')
	).toHaveCount(1);
	await expect(page.getByTestId('pwa-install-help')).toHaveCount(0);
	await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
	await expect(page.getByTestId('pwa-update-link')).toHaveCount(0);
	await expect(page.locator('footer').getByRole('status')).toHaveText(
		'All courses ready offline'
	);
	await expect(page.locator('footer details')).toHaveCount(0);
	await expect(page.getByTestId('pwa-downloading')).toHaveCount(0);
	await expect(page.getByTestId('pwa-status-details')).toHaveCount(0);
	await expect(
		page.getByTestId('pwa-status').locator('a, button, details')
	).toHaveCount(0);

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
	// The Plan navigation remains inside the installed shell while the brand
	// deliberately links to the landing. Offline plan navigation retains the document.
	const offlineTimeOrigin = await page.evaluate(() => performance.timeOrigin);
	const home = page.locator('header nav a[href="/app/plan"]');
	await expect(page.locator('header .brand')).toHaveAttribute('href', '/');
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

test('a failed worker replacement never announces an available update', async ({
	page
}) => {
	await ready(page);
	const originalTime = await page.evaluate(() => performance.timeOrigin);
	denyWorkerUpdate = true;
	const rejected = await page.evaluate(async () => {
		try {
			await (await navigator.serviceWorker.getRegistration())!.update();
			return false;
		} catch {
			return true;
		}
	});
	expect(rejected).toBe(true);
	expect(
		await page.evaluate(async () => {
			const registration = await navigator.serviceWorker.getRegistration();
			return {
				active: registration?.active?.state,
				waiting: registration?.waiting?.state
			};
		})
	).toEqual({ active: 'activated', waiting: undefined });
	await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
	await expect(page.getByTestId('pwa-update')).toHaveCount(0);
	await expect(page.getByTestId('pwa-update-link')).toHaveCount(0);
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(originalTime);
	denyWorkerUpdate = false;
	await page.evaluate(async () =>
		(await navigator.serviceWorker.getRegistration())!.update()
	);
	await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
});

test('accepting an update preserves saved data and rejects other open draft tabs across immutable deployments', async ({
	page,
	context,
	request,
	browserName
}) => {
	test.setTimeout(90_000);
	const courses = JSON.parse(await readFile('static/courseData.json', 'utf8'));
	await ready(page);
	const v1 = deploymentVersion();
	const runningVersion = page.getByTestId('footer-build-version');
	const compiledCommit = await page.evaluate(
		() =>
			document
				.querySelector('meta[name="planit-build"]')
				?.getAttribute('content') ?? null
	);
	await expect(runningVersion).toHaveAttribute('title', compiledCommit || v1);
	await expect(runningVersion).toHaveText(compiledCommit?.slice(0, 7) || v1);
	await expect(page.getByTestId('footer-update')).toHaveCount(0);
	const firstDeployment = deployment();
	const durableCourses = await storedCourses(page);
	expect(durableCourses.records).toBe(Object.keys(courses).length);
	const savedBefore = await page.evaluate(() =>
		localStorage.getItem('userData')
	);
	const initialTime = await page.evaluate(() => performance.timeOrigin);
	const oldLazyAsset = await page.evaluate(async (version) => {
		const loaded = new Set(
			performance.getEntriesByType('resource').map((entry) => entry.name)
		);
		const cache = await caches.open(`planit-console-shell-${version}`);
		return (await cache.keys())
			.map((request) => request.url)
			.find((url) => /\/nodes\/[^/]+\.js$/.test(url) && !loaded.has(url));
	}, v1);
	expect(oldLazyAsset).toBeTruthy();
	const oldPath = new URL(oldLazyAsset!).pathname;
	const oldOriginalPath = firstDeployment.networkAssets.get(oldPath)!;
	expect(oldOriginalPath).toBeTruthy();
	const oldResponse = await request.get(oldLazyAsset!);
	expect(oldResponse.status()).toBe(200);
	const oldBytes = await oldResponse.text();
	const sharedImport = oldBytes.match(/["'](\.\.\/chunks\/[^"']+\.js)["']/);
	expect(sharedImport).not.toBeNull();
	const oldSharedAsset = new URL(sharedImport![1], oldLazyAsset!).href;
	const oldSharedPath = new URL(oldSharedAsset).pathname;
	expect(firstDeployment.networkAssets.has(oldSharedPath)).toBe(true);
	const oldSharedResponse = await request.get(oldSharedAsset);
	expect(oldSharedResponse.status()).toBe(200);
	const oldSharedBytes = await oldSharedResponse.text();

	const otherTab = await context.newPage();
	await ready(otherTab);
	const otherTime = await otherTab.evaluate(() => performance.timeOrigin);
	await moveWishlistCourse(page, '02340124', 1);
	await moveWishlistCourse(otherTab, '02340141', 0);
	const otherDraft = await otherTab
		.locator('[data-code]')
		.evaluateAll((cards) =>
			cards.map((card) => card.getAttribute('data-code'))
		);
	let reloads = 0;
	let otherReloads = 0;
	page.on('domcontentloaded', () => reloads++);
	otherTab.on('domcontentloaded', () => otherReloads++);

	revision++;
	const v2 = deploymentVersion();
	const secondDeployment = deployment();
	expect(
		[...secondDeployment.networkAssets.keys()].some((path) =>
			firstDeployment.networkAssets.has(path)
		)
	).toBe(false);
	// APIRequestContext bypasses the browser/worker caches. The old build cannot
	// accidentally pass the transition regression by fetching retired chunks.
	expect((await request.get(oldLazyAsset!)).status()).toBe(404);
	expect((await request.get(oldSharedAsset)).status()).toBe(404);
	expect((await request.get(`${origin}${oldOriginalPath}`)).status()).toBe(404);
	const replacementPath = [...secondDeployment.networkAssets].find(
		([, original]) => original === oldOriginalPath
	)![0];
	const replacementResponse = await request.get(`${origin}${replacementPath}`);
	expect(replacementResponse.status()).toBe(200);
	expect(await replacementResponse.text()).not.toBe(oldBytes);
	await page.evaluate(async () =>
		(await navigator.serviceWorker.getRegistration())!.update()
	);
	await expect.poll(() => workerVersion(page, 'waiting')).toBe(v2);
	await expectUpdateBanner(page, v2);
	await expectUpdateBanner(otherTab, v2);
	const accept = page.getByTestId('footer-update');
	await expect(runningVersion).toHaveAttribute('title', compiledCommit || v1);
	await page.getByTestId('pwa-update-dismiss').click();
	await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
	await expect(accept).toBeVisible();
	await expect(accept).toBeDisabled();
	await expect(otherTab.getByTestId('footer-update')).toBeDisabled();
	expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
		savedBefore
	);
	expect(await workerVersion(page, 'controller')).toBe(v1);
	expect(reloads).toBe(0);
	expect(otherReloads).toBe(0);

	const save = page.getByRole('button', { name: 'Save', exact: true });
	// Fail precisely the next real guest-plan write, then immediately restore
	// native storage. A rejected Save is not permission to activate or reload.
	await page.evaluate(() => {
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string) {
			if (this === localStorage && key === 'userData') {
				Storage.prototype.setItem = setItem;
				document.documentElement.dataset.planSaveFailed = 'true';
				throw new DOMException(
					'Simulated plan save storage failure',
					'QuotaExceededError'
				);
			}
			return setItem.call(this, key, value);
		};
	});
	await save.click();
	await expect(page.locator('html')).toHaveAttribute(
		'data-plan-save-failed',
		'true'
	);
	await expect(save).toBeVisible();
	await expect(save).toBeEnabled();
	await expect(accept).toBeDisabled();
	await expect(
		page.locator('[data-semester="1"] [data-code="02340124"]')
	).toHaveCount(1);
	expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
		savedBefore
	);
	expect(await workerVersion(page, 'controller')).toBe(v1);
	expect(await workerVersion(page, 'waiting')).toBe(v2);
	expect(reloads).toBe(0);

	await save.click();
	await expect(save).toHaveCount(0);
	await expect(accept).toBeEnabled();
	const savedDraft = await page.evaluate(() =>
		localStorage.getItem('userData')
	);
	expect(savedDraft).not.toBe(savedBefore);
	expect(JSON.parse(savedDraft!).semesters[1]).toContain('02340124');

	// A dirty second tab is an actual controlled WindowClient, not a fabricated
	// BroadcastChannel response. It must block activation, never lose its draft.
	await page.locator('.footer-report').focus();
	await page.keyboard.press('Tab');
	await expect(accept).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('footer-update-error')).toHaveText(
		pwaMessages.en.updateOtherTabs
	);
	expect(await workerVersion(page, 'active')).toBe(v1);
	expect(await workerVersion(page, 'waiting')).toBe(v2);
	expect(await workerVersion(otherTab, 'controller')).toBe(v1);
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(initialTime);
	expect(await otherTab.evaluate(() => performance.timeOrigin)).toBe(otherTime);
	expect(reloads).toBe(0);
	expect(otherReloads).toBe(0);
	await expect(
		otherTab.locator('[data-semester="0"] [data-code="02340141"]')
	).toHaveCount(1);
	await expect(
		otherTab.getByRole('button', { name: 'Save', exact: true })
	).toBeVisible();
	await expect(otherTab.getByTestId('footer-update')).toBeDisabled();
	expect(
		await otherTab
			.locator('[data-code]')
			.evaluateAll((cards) =>
				cards.map((card) => card.getAttribute('data-code'))
			)
	).toEqual(otherDraft);
	expect(await otherTab.evaluate(() => localStorage.getItem('userData'))).toBe(
		savedDraft
	);

	await otherTab.close();
	await expect(accept).toBeEnabled();
	const acceptedReload = page.waitForEvent('domcontentloaded');
	await accept.focus();
	await page.keyboard.press('Space');
	await acceptedReload;
	await expect(page.getByTestId('footer-update')).toHaveCount(0);
	await expect(runningVersion).toHaveAttribute('title', compiledCommit || v2);
	await expect(runningVersion).toHaveText(compiledCommit?.slice(0, 7) || v2);
	await expect.poll(() => workerVersion(page, 'controller')).toBe(v2);
	await expect.poll(() => reloads).toBe(1);
	await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
	await expect(page.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready',
		{ timeout: 20000 }
	);
	expect(await workerVersion(page, 'active')).toBe(v2);
	expect(await workerVersion(page, 'waiting')).toBeNull();
	expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(
		initialTime
	);
	const newDocumentTime = await page.evaluate(() => performance.timeOrigin);
	expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
		savedDraft
	);
	await expect(
		page.locator('[data-semester="1"] [data-code="02340124"]')
	).toHaveCount(1);
	expect(await storedCourses(page)).toEqual(durableCourses);
	const loadedV2Assets = await page.evaluate(() =>
		performance
			.getEntriesByType('resource')
			.map((entry) => new URL(entry.name).pathname)
			.filter((path) => path.startsWith('/_app/immutable/'))
	);
	expect(loadedV2Assets.length).toBeGreaterThan(0);
	expect(
		loadedV2Assets.every((path) => secondDeployment.networkAssets.has(path))
	).toBe(true);

	// Take the origin away as well as Chromium's network emulator. Neither new
	// lazy navigation nor an old tab's retained chunk may fall back to the server.
	originDisconnected = true;
	server.closeAllConnections();
	await expect(fetch(`${origin}/offline-outage-probe`)).rejects.toThrow();
	if (browserName !== 'webkit') await context.setOffline(true);
	const oldAssetResponse = page.waitForResponse(
		(response) => response.url() === oldLazyAsset
	);
	const retainedBytes = await page.evaluate(async (url) => {
		const response = await fetch(url, { cache: 'no-store' });
		if (!response.ok) throw new Error(`Retired asset: ${response.status}`);
		return response.text();
	}, oldLazyAsset!);
	expect((await oldAssetResponse).fromServiceWorker()).toBe(true);
	expect(retainedBytes).toBe(oldBytes);
	// Import, rather than merely fetch, the v1 node in the fresh v2 document.
	// This forces its entire static dependency graph through the new controller,
	// including SvelteKit shared chunks whose filenames are hash.js, not name.hash.js.
	const importedChunks: { path: string; fromServiceWorker: boolean }[] = [];
	page.on('response', (response) => {
		const path = new URL(response.url()).pathname;
		if (/\/_app\/immutable\/chunks\/[^/]+\.js$/.test(path))
			importedChunks.push({
				path,
				fromServiceWorker: response.fromServiceWorker()
			});
	});
	const importedExports = await page.evaluate(
		async (url) => Object.keys(await import(url)),
		oldLazyAsset!
	);
	expect(importedExports.length).toBeGreaterThan(0);
	expect(importedChunks.some(({ path }) => path === oldSharedPath)).toBe(true);
	expect(
		importedChunks.every(
			({ path, fromServiceWorker }) =>
				fromServiceWorker && firstDeployment.networkAssets.has(path)
		)
	).toBe(true);
	expect(
		await page.evaluate(async (url) => {
			const response = await fetch(url, { cache: 'no-store' });
			if (!response.ok) throw new Error(`Retired chunk: ${response.status}`);
			return response.text();
		}, oldSharedAsset)
	).toBe(oldSharedBytes);
	const lazyResponses: { path: string; fromServiceWorker: boolean }[] = [];
	page.on('response', (response) => {
		const path = new URL(response.url()).pathname;
		if (/\/_app\/immutable\/nodes\/[^/]+\.js$/.test(path))
			lazyResponses.push({
				path,
				fromServiceWorker: response.fromServiceWorker()
			});
	});
	await page.locator('[data-code="02340141"]').click();
	await expect(page).toHaveURL(`${origin}/app/course/02340141`);
	await expect(page.locator('main')).toContainText(courses['02340141'].name);
	expect(
		lazyResponses.some(
			({ path, fromServiceWorker }) =>
				fromServiceWorker &&
				secondDeployment.networkAssets.has(path) &&
				!loadedV2Assets.includes(path)
		)
	).toBe(true);
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(
		newDocumentTime
	);
	expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
		savedDraft
	);
	expect(await storedCourses(page)).toEqual(durableCourses);
	expect(reloads).toBe(1);
	expect(otherReloads).toBe(0);
});

test('versioned dismissal preserves drafts until all tabs close and the new worker opens offline', async ({
	page,
	context,
	browserName
}, info) => {
	test.setTimeout(90_000);
	const viewport = { width: 390, height: 844 };
	await page.setViewportSize(viewport);
	const capture = async (name: string) => {
		await page.locator('header').scrollIntoViewIfNeeded();
		await page.evaluate(async () => {
			await document.fonts.ready;
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			);
		});
		const path = info.outputPath(`${browserName}-${name}-390.png`);
		await page.screenshot({ path, animations: 'disabled', fullPage: false });
		await info.attach(name, { path, contentType: 'image/png' });
	};
	const courses = JSON.parse(await readFile('static/courseData.json', 'utf8'));
	await ready(page);
	const v1 = deploymentVersion();
	expect(await workerVersion(page, 'active')).toBe(v1);
	expect(await workerVersion(page, 'controller')).toBe(v1);
	const durableCourses = await storedCourses(page);
	expect(durableCourses.records).toBe(Object.keys(courses).length);
	expect(durableCourses.count).toBe(durableCourses.records);
	expect(durableCourses.schemaVersion).toBe(1);
	const otherTab = await context.newPage();
	await otherTab.setViewportSize(viewport);
	await otherTab.goto(`${origin}/app/plan`);
	await expect(otherTab.locator('[data-code="02340124"]')).toBeVisible();
	// Make a real unsaved draft using native dragover in both engines. WebKit
	// needs a second target hover before mouseup; do not dispatch synthetic events.
	const destination = page.locator('[data-semester="1"]');
	await moveWishlistCourse(page, '02340124', 1);
	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save).toBeVisible();
	const draftOrder = await page
		.locator('[data-code]')
		.evaluateAll((cards) =>
			cards.map((card) => card.getAttribute('data-code'))
		);
	const saved = await page.evaluate(() => localStorage.getItem('userData'));
	const timeOrigin = await page.evaluate(() => performance.timeOrigin);
	const otherTimeOrigin = await otherTab.evaluate(() => performance.timeOrigin);
	await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
	await expect(otherTab.getByTestId('pwa-update-banner')).toHaveCount(0);

	revision++;
	const v2 = deploymentVersion();
	await page.evaluate(async () =>
		(await navigator.serviceWorker.getRegistration())!.update()
	);
	await expect.poll(() => workerVersion(page, 'waiting')).toBe(v2);
	await expectUpdateBanner(page, v2);
	await expectUpdateBanner(otherTab, v2);
	await capture('waiting-v2-mobile');
	// Exercise the real native footer language control in this same waiting-worker
	// session, retaining the unsaved draft and returning to English afterward.
	const language = page.locator('footer').getByRole('combobox');
	await language.scrollIntoViewIfNeeded();
	await expect(language).toHaveAccessibleName('Language');
	await language.selectOption({ label: 'עב' });
	await expect(language).toHaveAccessibleName('שפה');
	await page.locator('header').scrollIntoViewIfNeeded();
	await expectUpdateBanner(page, v2, 'he');
	await expect(page.getByTestId('footer-update')).toHaveAccessibleName('עדכון');
	await expect(page.getByTestId('footer-update')).toBeDisabled();
	await expect(page.getByTestId('footer-version')).toContainText('גרסה');
	const hebrewBanner = page.getByTestId('pwa-update-banner');
	await expect(hebrewBanner).toHaveCSS('direction', 'rtl');
	await expect(hebrewBanner.getByTestId('pwa-update')).toHaveCSS(
		'font-size',
		'13px'
	);
	const bannerBounds = (await hebrewBanner.boundingBox())!;
	const copy = hebrewBanner.getByTestId('pwa-update');
	const dismissBounds = (await hebrewBanner
		.getByTestId('pwa-update-dismiss')
		.boundingBox())!;
	const copyBounds = (await copy.boundingBox())!;
	for (const bounds of [bannerBounds, copyBounds, dismissBounds]) {
		expect(bounds.x).toBeGreaterThanOrEqual(0);
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
	}
	expect(bannerBounds.height).toBeLessThanOrEqual(80);
	expect(dismissBounds.width).toBeCloseTo(36, 1);
	expect(dismissBounds.height).toBeCloseTo(36, 1);
	expect(dismissBounds.x + dismissBounds.width).toBeLessThanOrEqual(
		copyBounds.x
	);
	expect(
		await copy.evaluate((element) => element.scrollWidth - element.clientWidth)
	).toBeLessThanOrEqual(1);
	await expect(
		page.getByRole('button', { name: 'שמור', exact: true })
	).toBeVisible();
	await expect(destination.locator('[data-code="02340124"]')).toHaveCount(1);
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
	expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
		saved
	);
	expect(await workerVersion(page, 'controller')).toBe(v1);
	expect(await workerVersion(page, 'waiting')).toBe(v2);
	await capture('waiting-v2-hebrew-rtl-mobile');
	await language.scrollIntoViewIfNeeded();
	await language.selectOption({ label: 'en' });
	await expect(language).toHaveAccessibleName('Language');
	await page.locator('header').scrollIntoViewIfNeeded();
	await expectUpdateBanner(page, v2);
	await expect(hebrewBanner).toHaveCSS('direction', 'ltr');
	await expect(save).toBeVisible();
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
	expect(await workerVersion(page, 'controller')).toBe(v1);
	expect(await workerVersion(page, 'waiting')).toBe(v2);
	await expect(page.getByTestId('pwa-status-details')).toHaveCount(0);
	await expect(page.getByTestId('pwa-incomplete')).toHaveCount(0);
	await page.getByTestId('pwa-update-dismiss').click();
	await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
	expect(
		await page.evaluate(() =>
			sessionStorage.getItem('planit-dismissed-update-version')
		)
	).toBe(v2);
	await expect(page.getByTestId('footer-update')).toBeDisabled();
	await expect(page.getByTestId('footer-update')).toHaveAccessibleName(
		'Update'
	);
	await expect(page.getByTestId('footer-version')).toContainText('Version');
	await capture('dismissed-v2-mobile');
	// Session dismissal belongs to one window and never activates the waiting worker.
	await expectUpdateBanner(otherTab, v2);
	expect(await workerVersion(page, 'active')).toBe(v1);
	expect(await workerVersion(page, 'controller')).toBe(v1);
	expect(await workerVersion(page, 'waiting')).toBe(v2);
	await otherTab.getByTestId('pwa-update-dismiss').click();
	await expect(otherTab.getByTestId('pwa-update-banner')).toHaveCount(0);
	for (let attempt = 0; attempt < 2; attempt++) {
		await otherTab.locator('header nav a[href="/app/catalog"]').click();
		await expect(otherTab).toHaveURL(`${origin}/app/catalog`);
		await expect(otherTab.getByTestId('pwa-update-banner')).toHaveCount(0);
		await otherTab.goBack();
		await expect(otherTab).toHaveURL(`${origin}/app/plan`);
		await expect(otherTab.getByTestId('pwa-update-banner')).toHaveCount(0);
	}
	expect(await otherTab.evaluate(() => performance.timeOrigin)).toBe(
		otherTimeOrigin
	);
	await otherTab.addInitScript(() => {
		new MutationObserver((records) => {
			for (const record of records)
				for (const node of record.addedNodes)
					if (
						node instanceof Element &&
						(node.matches('[data-testid="pwa-update-banner"]') ||
							node.querySelector('[data-testid="pwa-update-banner"]'))
					)
						document.documentElement.dataset.dismissedUpdateBannerSeen = 'true';
		}).observe(document, { childList: true, subtree: true });
	});
	await otherTab.reload();
	await expect(otherTab.locator('[data-code="02340124"]')).toBeVisible();
	await expect.poll(() => workerVersion(otherTab, 'waiting')).toBe(v2);
	await expect(otherTab.getByTestId('pwa-update-banner')).toHaveCount(0);
	await otherTab.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	await expect(otherTab.locator('html')).not.toHaveAttribute(
		'data-dismissed-update-banner-seen',
		'true'
	);
	expect(
		await otherTab.evaluate(() =>
			sessionStorage.getItem('planit-dismissed-update-version')
		)
	).toBe(v2);

	// A genuinely different waiting build must resurface after the previous version
	// was dismissed. The superseded worker becomes redundant through the native API.
	revision++;
	const v3 = deploymentVersion();
	await page.evaluate(async () =>
		(await navigator.serviceWorker.getRegistration())!.update()
	);
	await expect.poll(() => workerVersion(page, 'waiting')).toBe(v3);
	await expectUpdateBanner(page, v3);
	await expectUpdateBanner(otherTab, v3);
	await capture('waiting-v3-mobile');
	await page.getByTestId('pwa-update-dismiss').click();
	await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
	expect(
		await page.evaluate(() =>
			sessionStorage.getItem('planit-dismissed-update-version')
		)
	).toBe(v3);
	await expect(save).toBeVisible();
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
	expect(await storedCourses(page)).toEqual(durableCourses);
	expect(await workerVersion(page, 'active')).toBe(v1);
	expect(await workerVersion(otherTab, 'controller')).toBe(v1);

	// The existing close-all-tabs path remains safe without accepting an update:
	// save, close every controlled client, then reopen.
	await save.click();
	await expect(save).toHaveCount(0);
	const savedDraft = await page.evaluate(() =>
		localStorage.getItem('userData')
	);
	expect(savedDraft).not.toBe(saved);
	await page.close();
	expect(await workerVersion(otherTab, 'active')).toBe(v1);
	expect(await workerVersion(otherTab, 'waiting')).toBe(v3);
	await otherTab.close();
	const reopened = await context.newPage();
	await reopened.setViewportSize(viewport);
	await reopened.goto(`${origin}/app/plan`);
	await expect(reopened.locator('[data-code="02340124"]')).toBeVisible();
	await expect.poll(() => workerVersion(reopened, 'active')).toBe(v3);
	await expect.poll(() => workerVersion(reopened, 'controller')).toBe(v3);
	expect(await workerVersion(reopened, 'waiting')).toBeNull();
	await expect(reopened.getByTestId('pwa-update-banner')).toHaveCount(0);
	await expect(reopened.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready',
		{ timeout: 20000 }
	);
	expect(await reopened.evaluate(() => localStorage.getItem('userData'))).toBe(
		savedDraft
	);
	expect(await storedCourses(reopened)).toEqual(durableCourses);
	await reopened.reload();
	await expect(reopened.locator('[data-code="02340124"]')).toBeVisible();
	await expect(reopened.getByTestId('pwa-update-banner')).toHaveCount(0);
	await expect(reopened.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready'
	);

	// The newly active build must still open a never-visited course entirely offline.
	const reopenedTime = await reopened.evaluate(() => performance.timeOrigin);
	// Disconnect the actual origin in both engines, proving cached responses cannot
	// forward to a working network. WebKit avoids setOffline because its emulator
	// rejects even SW-only responses; this is not physical iOS airplane-mode QA.
	originDisconnected = true;
	server.closeAllConnections();
	await expect(fetch(`${origin}/offline-outage-probe`)).rejects.toThrow();
	if (browserName !== 'webkit') await context.setOffline(true);
	await reopened.locator('[data-code="02340141"]').click();
	await expect(reopened).toHaveURL(`${origin}/app/course/02340141`);
	await expect(reopened.locator('main')).toContainText(
		courses['02340141'].name
	);
	expect(await reopened.evaluate(() => performance.timeOrigin)).toBe(
		reopenedTime
	);
	const offlineReload = await reopened.reload();
	expect(offlineReload?.fromServiceWorker()).toBe(true);
	await expect(reopened.locator('main')).toContainText(
		courses['02340141'].name
	);
	if (browserName !== 'webkit')
		await expect(reopened.getByTestId('plan-read-only')).toBeVisible();
	expect(await workerVersion(reopened, 'controller')).toBe(v3);
	expect(await reopened.evaluate(() => localStorage.getItem('userData'))).toBe(
		savedDraft
	);
	expect(await storedCourses(reopened)).toEqual(durableCourses);
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
	await viewOfflineError(page);
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
	await viewOfflineError(page);
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
	await expect(page.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready'
	);
	// In this routed signed-in context, Chromium can still let the worker repair
	// an evicted asset despite context.setOffline(true). Disconnect the actual
	// proxy too, so this exercises an unavailable shell rather than a repair.
	originDisconnected = true;
	server.closeAllConnections();
	await expect(fetch(`${origin}/offline-outage-probe`)).rejects.toThrow();
	const eviction = await page.evaluate(async () => {
		const name = (await caches.keys()).find((name) =>
			name.startsWith('planit-console-shell-')
		)!;
		const cache = await caches.open(name);
		const asset = (await cache.keys()).find(
			(request) =>
				request.url.includes('/nodes/') && request.url.endsWith('.js')
		)!;
		const deleted = await cache.delete(asset);
		const remains = !!(await cache.match(asset));
		window.dispatchEvent(new Event('pageshow'));
		return { deleted, remains, url: asset.url };
	});
	expect(eviction.deleted).toBe(true);
	expect(eviction.remains).toBe(false);
	await viewOfflineError(page);
	await expect(page.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'error'
	);
	expect(
		await page.evaluate(
			async (url) => !!(await caches.match(url)),
			eviction.url
		)
	).toBe(false);
	await expect(
		page.getByTestId('pwa-error-detail').filter({
			hasText:
				/Some app files could not be downloaded|Offline setup took too long|Offline app files could not be verified/
		})
	).toBeVisible();
	await expect(page.getByTestId('pwa-status-details')).toBeInViewport();
	await expect(page.locator('main')).toBeHidden();
	expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
		guestPlan
	);
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
	await viewOfflineError(page, 35_000);
	await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
	await expect(page.getByTestId('pwa-incomplete')).toBeVisible();
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
	await viewOfflineError(page);
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
