import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
	expect,
	test as base,
	type Page,
	type Request
} from '@playwright/test';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const publicData =
	/\/(?:catalogs\.json|courseData(?:Stripped)?\.json|_courses\/|_catalogs\/)/;
const firebaseEndpoint =
	/(?:firebase(?:app|installations|remoteconfig|settings)?\.|firestore\.|identitytoolkit\.|securetoken\.|\/__\/auth\/|localhost:9099|127\.0\.0\.1:9099|127\.0\.0\.1:8080)/i;
const analyticsEndpoint =
	/(?:google-analytics\.|googletagmanager\.|analytics\.google\.|vercel-insights\.|vercel-scripts\.|\/_vercel\/(?:insights|speed-insights)\/|posthog\.)/i;
const workerOrManifest =
	/(?:service-worker\.js|manifest\.webmanifest)(?:[?#]|$)/;

type StartupRequest = {
	url: string;
	resourceType: string;
	category: string;
	navigation: boolean;
	phase: 'landing' | 'console-startup' | 'warm-reload';
};

type StartupNetwork = {
	requests: StartupRequest[];
	phase: StartupRequest['phase'];
	dataDelay: {
		armed: boolean;
		requested: boolean;
		released: boolean;
		resources: string[];
		description: string;
	};
};

function safeRequestUrl(value: string) {
	const url = new URL(value);
	if (!['http:', 'https:'].includes(url.protocol))
		return `${url.protocol}[omitted]`;
	// Keep endpoint evidence without query tokens, credentials, fragments,
	// request/response bodies, headers, account data, or browser storage.
	if (firebaseEndpoint.test(value) || analyticsEndpoint.test(value)) {
		return `${url.origin}/[provider-path-redacted]`;
	}
	return `${url.origin}${url.pathname}`;
}

function summarizeRequests(requests: StartupRequest[]) {
	const byResourceType: Record<string, number> = {};
	const byCategory: Record<string, number> = {};
	for (const request of requests) {
		byResourceType[request.resourceType] =
			(byResourceType[request.resourceType] ?? 0) + 1;
		byCategory[request.category] = (byCategory[request.category] ?? 0) + 1;
	}
	return { count: requests.length, byResourceType, byCategory, requests };
}

const test = base.extend<{ startupNetwork: StartupNetwork }>({
	startupNetwork: async ({ context }, use, testInfo) => {
		const network: StartupNetwork = {
			requests: [],
			phase: 'landing',
			dataDelay: {
				armed: false,
				requested: false,
				released: false,
				resources: ['/courseData.json'],
				description:
					'The test deliberately withholds courseData.json until loading-screen assertions and a 1800ms analytics-ordering check finish.'
			}
		};
		const recordRequest = (request: Request) => {
			network.requests.push({
				url: request.url(),
				resourceType: request.resourceType(),
				category: analyticsEndpoint.test(request.url())
					? 'analytics'
					: firebaseEndpoint.test(request.url())
						? 'firebase'
						: publicData.test(request.url())
							? 'public-data'
							: workerOrManifest.test(request.url())
								? 'worker-or-manifest'
								: 'other',
				navigation: request.isNavigationRequest(),
				phase: network.phase
			});
		};
		context.on('request', recordRequest);
		try {
			await use(network);
		} finally {
			context.off('request', recordRequest);
			const sanitized = network.requests.map((request) => ({
				...request,
				url: safeRequestUrl(request.url)
			}));
			// A real file survives list-only reporters; the attachment also exposes
			// the same sanitized evidence in HTML reports, on passes and failures.
			const diagnosticPath = testInfo.outputPath('startup-network.json');
			const diagnostic = {
				schemaVersion: 1,
				test: testInfo.title,
				status: testInfo.status,
				observation:
					'Attempted requests observed until the test ends, including intercepted or failed requests. Phases are set immediately before entering the console or starting a warm reload. Artificial delays make this diagnostic unsuitable for startup timing claims.',
				artificialDataDelay: network.dataDelay,
				landing: summarizeRequests(
					sanitized.filter((request) => request.phase === 'landing')
				),
				consoleStartup: summarizeRequests(
					sanitized.filter((request) => request.phase === 'console-startup')
				),
				warmReload: summarizeRequests(
					sanitized.filter((request) => request.phase === 'warm-reload')
				)
			};
			await mkdir(dirname(diagnosticPath), { recursive: true });
			await writeFile(
				diagnosticPath,
				`${JSON.stringify(diagnostic, null, 2)}\n`
			);
			await testInfo.attach('startup-network.json', {
				contentType: 'application/json',
				path: diagnosticPath
			});
		}
	}
});

// Allow workers so accidental landing registration cannot be hidden by the
// default block setting. Every test starts in a fresh anonymous context.
test.use({ serviceWorkers: 'allow' });

async function publicDataReady(page: Page) {
	return page.evaluate(async () => {
		async function read(databaseName: string, storeName: string, key?: string) {
			return new Promise<number | boolean>((resolve) => {
				const request = indexedDB.open(databaseName, 1);
				// A probe must not create an empty database and poison bootstrap.
				request.onupgradeneeded = () => request.transaction?.abort();
				request.onerror = () => resolve(false);
				request.onsuccess = () => {
					const database = request.result;
					if (!database.objectStoreNames.contains(storeName)) {
						database.close();
						resolve(false);
						return;
					}
					const transaction = database.transaction(storeName, 'readonly');
					const store = transaction.objectStore(storeName);
					const result = key ? store.get(key) : store.count();
					transaction.oncomplete = () => {
						database.close();
						resolve(key ? Boolean(result.result?.data) : Number(result.result));
					};
					transaction.onabort = () => {
						database.close();
						resolve(false);
					};
				};
			});
		}
		const [courses, catalogs] = await Promise.all([
			read('degree-planner-courses', 'courses'),
			read('degree-planner-public-data', 'resources', '/catalogs.json')
		]);
		return Number(courses) > 100 && catalogs === true;
	});
}

for (const language of ['en', 'he'] as const) {
	for (const width of [390, 1280]) {
		test(`${language} ${width}px: isolated landing, native console entry and visible data bootstrap`, async ({
			page,
			context,
			startupNetwork
		}) => {
			test.setTimeout(60_000);
			await page.setViewportSize({ width, height: 844 });
			// Mobile exercises light-mode continuity; desktop retains dark coverage.
			const theme = width === 390 ? 'light' : 'dark';
			const background =
				theme === 'light' ? 'rgb(248, 250, 252)' : 'rgb(25, 25, 29)';
			const foreground =
				theme === 'light' ? 'rgb(23, 37, 51)' : 'rgb(255, 255, 255)';
			await page.addInitScript(
				({ language, theme }) => {
					localStorage.setItem('lang', language);
					localStorage.setItem('theme', theme);
				},
				{ language, theme }
			);
			const { requests } = startupNetwork;
			// Record provider attempts without sending analytics or authentication
			// traffic to real third parties during this anonymous startup test.
			await context.route('**/*', async (route) => {
				if (
					firebaseEndpoint.test(route.request().url()) ||
					analyticsEndpoint.test(route.request().url())
				) {
					await route.abort();
				} else await route.continue();
			});

			await page.goto(new URL(language === 'en' ? '/en' : '/', origin).href);
			await expect(page.locator('.landing')).toHaveAttribute(
				'dir',
				language === 'he' ? 'rtl' : 'ltr'
			);
			await expect(page.locator('body')).toHaveCSS(
				'background-color',
				background
			);
			const start = page
				.getByRole('link', {
					name: language === 'he' ? 'התחל' : 'Get Started',
					exact: true
				})
				.first();
			await expect(start).toHaveAttribute('href', '/app/');
			await expect(start).toHaveAttribute('data-sveltekit-reload', '');
			await expect(page.locator('#console-boot')).toBeHidden();
			await start.hover();
			// Covers the 1500ms optional-analytics delay and hover preloading.
			await page.waitForTimeout(1800);
			const forbiddenLandingRequests = requests.filter(
				({ url }) =>
					firebaseEndpoint.test(url) ||
					analyticsEndpoint.test(url) ||
					publicData.test(url) ||
					workerOrManifest.test(url) ||
					/^\/app(?:\/|$)/.test(new URL(url).pathname)
			);
			expect(forbiddenLandingRequests).toEqual([]);
			await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
			expect(
				await page.evaluate(async () =>
					'serviceWorker' in navigator
						? (await navigator.serviceWorker.getRegistrations()).length
						: 0
				)
			).toBe(0);

			let releaseCourses!: () => void;
			const coursesReleased = new Promise<void>((resolve) => {
				releaseCourses = resolve;
			});
			let courseRequested = false;
			startupNetwork.dataDelay.armed = true;
			await page.route('**/courseData.json', async (route) => {
				courseRequested = true;
				startupNetwork.dataDelay.requested = true;
				await coursesReleased;
				await route.continue();
			});
			const beforeEntry = requests.length;
			startupNetwork.phase = 'console-startup';
			try {
				await start.click({ noWaitAfter: true });
				await expect
					.poll(() =>
						requests
							.slice(beforeEntry)
							.some(
								({ url, navigation }) =>
									navigation && /^\/app(?:\/|$)/.test(new URL(url).pathname)
							)
					)
					.toBe(true);
				await expect.poll(() => courseRequested).toBe(true);
				await expect(page.locator('#console-boot')).toBeVisible();
				await expect(page.locator('#console-boot')).toHaveCSS(
					'background-color',
					background
				);
				await expect(page.locator('#console-boot')).toHaveCSS(
					'color',
					foreground
				);
				await expect(page.locator('#console-boot-detail')).toHaveText(
					language === 'he' ? 'טוענים קורסים…' : 'Loading courses…'
				);
				// Analytics scheduling starts after the console mounts, not while
				// its mandatory full course dataset is still downloading.
				await page.waitForTimeout(1800);
				expect(
					requests
						.slice(beforeEntry)
						.filter(({ url }) => analyticsEndpoint.test(url))
				).toEqual([]);
				await expect(page.locator('#console-boot')).toBeVisible();
			} finally {
				startupNetwork.dataDelay.released = true;
				releaseCourses();
			}
			await expect(page).toHaveURL(/\/app\/(?:settings|plan)(?:[?#]|$)/);
			await expect(page.locator('#console-boot')).toBeHidden({
				timeout: 20_000
			});
			await expect
				.poll(() => publicDataReady(page), { timeout: 20_000 })
				.toBe(true);
			await expect(page.locator('main')).toBeVisible();
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await expect(page.locator('body')).toHaveCSS(
				'background-color',
				background
			);
		});
	}
}

for (const theme of ['dark', 'light'] as const) {
	test(`${theme} console boot keeps its theme before scripts or styles load`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.addInitScript((theme) => {
			localStorage.setItem('lang', 'en');
			localStorage.setItem('theme', theme);
		}, theme);
		await page.route('**/_app/**', (route) => route.abort());
		await page.goto(`${origin}/app/`);
		const boot = page.locator('#console-boot');
		await expect(boot).toBeVisible();
		await expect(boot).toHaveCSS(
			'background-color',
			theme === 'light' ? 'rgb(248, 250, 252)' : 'rgb(25, 25, 29)'
		);
		await expect(boot).toHaveCSS(
			'color',
			theme === 'light' ? 'rgb(23, 37, 51)' : 'rgb(255, 255, 255)'
		);
	});
}

for (const language of ['en', 'he'] as const) {
	for (const theme of ['dark', 'light'] as const) {
		test(`${language} ${theme} branded boot is accessible on a narrow screen without app assets`, async ({
			page
		}) => {
			await page.setViewportSize({ width: 320, height: 640 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript(
				({ language, theme }) => {
					localStorage.setItem('lang', language);
					localStorage.setItem('theme', theme);
				},
				{ language, theme }
			);
			await page.route('**/_app/**', (route) => route.abort());
			await page.goto(`${origin}/app/`);
			const boot = page.locator('#console-boot');
			await expect(boot).toBeVisible();
			await expect(boot).not.toHaveAttribute('aria-busy', 'true');
			await expect(boot.getByRole('heading')).toHaveCount(0);
			await expect(boot.locator('.console-loading__track')).toBeVisible();
			await expect(boot.getByRole('status')).toHaveText(
				language === 'he' ? 'טוענים קורסים…' : 'Loading courses…'
			);
			await expect
				.poll(() =>
					boot
						.locator('img')
						.evaluateAll((images) =>
							images.every(
								(image) =>
									(image as HTMLImageElement).complete &&
									(image as HTMLImageElement).naturalWidth > 0
							)
						)
				)
				.toBe(true);
			await expect(boot.locator('.console-loading__indicator')).toHaveCSS(
				'animation-name',
				'none'
			);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth)
			).toBeLessThanOrEqual(320);
			const content = await boot
				.locator('.console-loading__content')
				.boundingBox();
			expect(content).not.toBeNull();
			expect(content!.x).toBeGreaterThanOrEqual(0);
			expect(content!.x + content!.width).toBeLessThanOrEqual(320);
			expect(content!.y).toBeGreaterThanOrEqual(0);
			expect(content!.y + content!.height).toBeLessThanOrEqual(640);
		});
	}
}

test('branded boot keeps its status reachable on a short landscape screen', async ({
	page
}) => {
	await page.setViewportSize({ width: 568, height: 280 });
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.route('**/_app/**', (route) => route.abort());
	await page.goto(`${origin}/app/`);
	const status = page.locator('#console-boot-detail');
	await status.scrollIntoViewIfNeeded();
	const bounds = await status.boundingBox();
	expect(bounds).not.toBeNull();
	expect(bounds!.y).toBeGreaterThanOrEqual(0);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(280);
	await page.locator('#console-boot-logo').scrollIntoViewIfNeeded();
	expect(
		(await page.locator('#console-boot-logo').boundingBox())!.y
	).toBeGreaterThanOrEqual(0);
});

test.describe('warm cached console bootstrap', () => {
	// Isolate IndexedDB readiness from service-worker precaching/routing.
	// Installed-shell offline behavior is exercised by the separate PWA suite.
	test.use({ serviceWorkers: 'block' });

	test('renders cached data while course and catalog refreshes remain stalled', async ({
		page,
		context,
		startupNetwork
	}) => {
		test.setTimeout(60_000);
		await page.addInitScript(() => localStorage.setItem('lang', 'en'));
		await context.route('**/*', async (route) => {
			if (
				firebaseEndpoint.test(route.request().url()) ||
				analyticsEndpoint.test(route.request().url())
			) {
				await route.abort();
			} else await route.continue();
		});
		startupNetwork.phase = 'console-startup';
		await page.goto(`${origin}/app/`);
		await expect
			.poll(() => publicDataReady(page), { timeout: 20_000 })
			.toBe(true);
		await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
		await expect(page.locator('#console-boot')).toBeHidden();

		let releaseRefreshes!: () => void;
		const refreshesReleased = new Promise<void>((resolve) => {
			releaseRefreshes = resolve;
		});
		const stalled = new Set<string>();
		let resumed = 0;
		startupNetwork.dataDelay = {
			armed: true,
			requested: false,
			released: false,
			resources: ['/courseData.json', '/catalogs.json'],
			description:
				'Warm-cache test deliberately withholds both background refreshes until cached UI readiness is asserted within a 5-second test timeout. This is a functional regression check, not a natural startup benchmark.'
		};
		await page.route(
			/\/(?:courseData|catalogs)\.json(?:[?#].*)?$/,
			async (route) => {
				stalled.add(new URL(route.request().url()).pathname);
				startupNetwork.dataDelay.requested = true;
				await refreshesReleased;
				resumed++;
				await route.continue();
			}
		);
		startupNetwork.phase = 'warm-reload';
		try {
			await page.reload({ waitUntil: 'domcontentloaded' });
			await expect
				.poll(
					async () =>
						stalled.has('/courseData.json') &&
						stalled.has('/catalogs.json') &&
						(await page.locator('main').isVisible()) &&
						!(await page.locator('#console-boot').isVisible()),
					{ timeout: 5000 }
				)
				.toBe(true);
			expect(resumed).toBe(0);
			expect(startupNetwork.dataDelay.released).toBe(false);
		} finally {
			startupNetwork.dataDelay.released = true;
			releaseRefreshes();
		}
	});
});
