import { expect, test, type Page } from '@playwright/test';

// Allow workers here so accidental landing registration cannot be hidden by
// Playwright's default block setting. Every test still starts in a fresh context.
test.use({ serviceWorkers: 'allow' });

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const publicData =
	/\/(?:catalogs\.json|courseData(?:Stripped)?\.json|_courses\/|_catalogs\/)/;
const firebaseEndpoint =
	/(?:firebase(?:app|installations|remoteconfig|settings)?\.|firestore\.|identitytoolkit\.|securetoken\.|\/__\/auth\/|localhost:9099|127\.0\.0\.1:9099|127\.0\.0\.1:8080)/i;
const analyticsEndpoint =
	/(?:google-analytics\.|googletagmanager\.|analytics\.google\.|vercel-insights\.|vercel-scripts\.|\/_vercel\/(?:insights|speed-insights)\/|posthog\.)/i;
const workerOrManifest =
	/(?:service-worker\.js|manifest\.webmanifest)(?:[?#]|$)/;

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
			context
		}) => {
			test.setTimeout(60_000);
			await page.setViewportSize({ width, height: 844 });
			await page.addInitScript(
				(language) => localStorage.setItem('lang', language),
				language
			);
			const requests: { url: string; navigation: boolean }[] = [];
			context.on('request', (request) => {
				requests.push({
					url: request.url(),
					navigation: request.isNavigationRequest()
				});
			});
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
			await page.route('**/courseData.json', async (route) => {
				courseRequested = true;
				await coursesReleased;
				await route.continue();
			});
			const beforeEntry = requests.length;
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
		});
	}
}
