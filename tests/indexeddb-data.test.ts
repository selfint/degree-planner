import { expect, test, type Page } from '@playwright/test';
import { pwaMessages } from '../src/lib/pwa/messages';

// These tests isolate IndexedDB. Real airplane-mode shell coverage lives in pwa.test.ts.
test.use({ serviceWorkers: 'block' });

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];
const programUrl = `/_catalogs/${degree.join('/')}/requirementsData.json`;
const previewUrl = `/app/preview/${degree.join('/')}?path=CG00006253&semesters=01140052~00104031`;
const savedPlan = {
	degree,
	path: 'CG00006253',
	exemptions: ['00104031'],
	semesters: [['00234114'], []],
	currentSemester: 1,
	wishlist: ['99999999']
};
const publicData =
	/\/(?:catalogs\.json|courseData(?:Stripped)?\.json|_courses\/\d{8}|_catalogs\/[^?]+\/requirementsData\.json)$/;

async function seed(page: Page, language = 'en') {
	await page.addInitScript(
		({ language, savedPlan }) => {
			// Seed once, so a reload cannot hide an accidental storage rewrite.
			if (localStorage.getItem('idb-test-seeded')) return;
			localStorage.setItem('lang', language);
			localStorage.setItem('version', '4');
			localStorage.setItem('userData', JSON.stringify(savedPlan));
			localStorage.setItem('idb-test-seeded', 'true');
		},
		{ language, savedPlan }
	);
}

async function resources(
	page: Page
): Promise<{ key: string; data: unknown; schemaVersion: number }[]> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const request = indexedDB.open('degree-planner-public-data', 1);
				let createdByProbe = false;
				request.onupgradeneeded = () => {
					// Observing before hydration must never create an empty app database.
					createdByProbe = true;
					request.transaction?.abort();
				};
				request.onerror = () => {
					if (createdByProbe && request.error?.name === 'AbortError')
						resolve([]);
					else reject(request.error);
				};
				request.onsuccess = () => {
					const db = request.result;
					if (!db.objectStoreNames.contains('resources')) {
						db.close();
						resolve([]);
						return;
					}
					try {
						const tx = db.transaction('resources', 'readonly');
						const result = tx.objectStore('resources').getAll();
						tx.oncomplete = () => {
							db.close();
							resolve(result.result);
						};
						tx.onabort = () => {
							db.close();
							reject(tx.error);
						};
					} catch (error) {
						db.close();
						reject(error);
					}
				};
			})
	);
}

type CourseSnapshot = {
	count: number;
	metadata?: {
		key: string;
		schemaVersion: number;
		count: number;
		validatedAt: number;
		revision: string;
	};
	courses?: { code: string; [field: string]: unknown }[];
	courseKeyPath?: string | string[] | null;
	metaKeyPath?: string | string[] | null;
};

async function courseSnapshot(
	page: Page,
	includeCourses = false
): Promise<CourseSnapshot> {
	return page.evaluate(
		(includeCourses) =>
			new Promise<CourseSnapshot>((resolve, reject) => {
				const request = indexedDB.open('degree-planner-courses', 1);
				let createdByProbe = false;
				request.onupgradeneeded = () => {
					createdByProbe = true;
					request.transaction?.abort();
				};
				request.onerror = () => {
					if (createdByProbe && request.error?.name === 'AbortError')
						resolve({ count: 0 });
					else reject(request.error);
				};
				request.onsuccess = () => {
					const db = request.result;
					if (
						!db.objectStoreNames.contains('courses') ||
						!db.objectStoreNames.contains('meta')
					) {
						db.close();
						resolve({ count: 0 });
						return;
					}
					try {
						const tx = db.transaction(['courses', 'meta'], 'readonly');
						const courses = tx.objectStore('courses');
						const meta = tx.objectStore('meta');
						const count = courses.count();
						const metadata = meta.get('courses');
						const allCourses = includeCourses ? courses.getAll() : undefined;
						tx.oncomplete = () => {
							db.close();
							resolve({
								count: count.result,
								metadata: metadata.result,
								courses: allCourses?.result,
								courseKeyPath: courses.keyPath,
								metaKeyPath: meta.keyPath
							});
						};
						tx.onabort = () => {
							db.close();
							reject(tx.error);
						};
					} catch (error) {
						db.close();
						reject(error);
					}
				};
			}),
		includeCourses
	);
}

async function expectCoursesReady(page: Page, count?: number) {
	await expect
		.poll(
			async () => {
				const snapshot = await courseSnapshot(page);
				return (
					snapshot.metadata?.key === 'courses' &&
					snapshot.metadata.schemaVersion === 1 &&
					snapshot.metadata.count === snapshot.count &&
					(count === undefined ? snapshot.count > 0 : snapshot.count === count)
				);
			},
			{ timeout: 15000 }
		)
		.toBe(true);
}

async function expectSavedPlanUnchanged(page: Page) {
	// Compare bytes as well as values: caching must never rewrite the user's plan.
	expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
		JSON.stringify(savedPlan)
	);
}

async function blockPublicData(page: Page) {
	await page.route(publicData, (route) => route.abort('internetdisconnected'));
	// Keep the app shell available while emulating unavailable public data. Remove
	// SSR-embedded fetch payloads so they cannot hide a broken IndexedDB read.
	await page.route(
		(url) => url.origin === origin,
		async (route) => {
			if (route.request().resourceType() !== 'document')
				return route.fallback();
			const response = await route.fetch();
			await route.fulfill({
				response,
				body: (await response.text()).replace(
					/<script\b[^>]*data-sveltekit-fetched[^>]*>[\s\S]*?<\/script>/g,
					''
				)
			});
		}
	);
}

for (const language of ['en', 'he'] as const) {
	test(`reloads cached course/app/catalog/requirements in ${language} with all public data requests blocked`, async ({
		page,
		request
	}) => {
		await seed(page, language);
		const requirement = await (await request.get(origin + programUrl)).json();
		const courses = await (
			await request.get(origin + '/courseData.json')
		).json();
		const courseName = courses['01140052'].name;
		const pathName = requirement.nested.find(
			(item: { name: string }) => item.name === 'CG00006253'
		)[language];
		await page.goto(origin + previewUrl);
		await expect(page.locator('main h1').first()).toContainText(pathName);
		await expect
			.poll(async () => (await resources(page)).map((entry) => entry.key))
			.toEqual([
				'/_catalogs/2024_200/00002120/SC00001314_CG00006245/requirementsData.json',
				'/catalogs.json'
			]);
		await expectCoursesReady(page, Object.keys(courses).length);
		await blockPublicData(page);
		await page.route(
			/https:\/\/[^/]*(googleapis\.com|firebaseio\.com|firebaseapp\.com)\//,
			(route) => route.abort()
		);
		await page.reload();
		await expect(page.locator('main')).toContainText(courseName);
		await expect(page.locator('main h1').first()).toContainText(pathName);
		await expect(page.locator('main h1').first()).toContainText(
			requirement[language]
		);
		await expectSavedPlanUnchanged(page);
		expect(
			(await resources(page)).every(
				(entry) => entry.schemaVersion === 1 && publicData.test(entry.key)
			)
		).toBe(true);
		// Changing language uses the same complete bilingual record, not another network fetch.
		await page.evaluate(
			(next) => localStorage.setItem('lang', next),
			language === 'en' ? 'he' : 'en'
		);
		await page.reload();
		await expect(page.locator('main')).toContainText(courseName);
		await expect(page.locator('main h1').first()).toContainText(
			requirement[language === 'en' ? 'he' : 'en']
		);
	});
}

test('downloads every canonical course on opening the site and serves a never-visited course with JSON offline', async ({
	page,
	request
}) => {
	await seed(page);
	const courses = await (await request.get(origin + '/courseData.json')).json();
	const code = '01140052';
	const course = courses[code];
	expect(course.about.trim().length).toBeGreaterThan(20);
	const about = course.about.trim().slice(0, 60);
	const visitedCourseUrls: string[] = [];
	page.on('request', (request) => {
		if (/\/(?:course|_courses)\/\d{8}$/.test(new URL(request.url()).pathname)) {
			visitedCourseUrls.push(request.url());
		}
	});
	// Opening the console is sufficient; no search/detail route warms the data.
	await page.goto(origin + '/app/');
	await expectCoursesReady(page, Object.keys(courses).length);
	const snapshot = await courseSnapshot(page, true);
	expect(snapshot.courseKeyPath).toBe('code');
	expect(snapshot.metaKeyPath).toBe('key');
	expect(snapshot.metadata).toMatchObject({
		key: 'courses',
		schemaVersion: 1,
		count: Object.keys(courses).length,
		validatedAt: expect.any(Number),
		revision: expect.any(String)
	});
	expect(
		Object.fromEntries(snapshot.courses!.map((course) => [course.code, course]))
	).toEqual(courses);
	expect(visitedCourseUrls).toEqual([]);
	expect(
		(await resources(page)).some(
			(entry) =>
				entry.key === '/courseData.json' ||
				entry.key === '/courseDataStripped.json' ||
				(entry.key.startsWith('/_courses/') &&
					entry.key.slice('/_courses/'.length) in courses)
		)
	).toBe(false);
	await expectSavedPlanUnchanged(page);

	await blockPublicData(page);
	// The document and route chunks remain online, while SSR-embedded JSON is
	// removed. A never-visited detail must now be reconstructed from entity records.
	await page.goto(origin + `/app/course/${code}`);
	await expect(page.locator('main h1').first()).toContainText(course.name);
	await expect(page.locator('main')).toContainText(about);
	await page.reload();
	await expect(page.locator('main h1').first()).toContainText(course.name);
	await expect(page.locator('main')).toContainText(about);
	await page.goto(origin + `/app/search?q=${code}`);
	await expect(page.locator('main')).toContainText(course.name);
	const afterReload = await courseSnapshot(page, true);
	expect(
		Object.fromEntries(
			afterReload.courses!.map((course) => [course.code, course])
		)
	).toEqual(courses);
	await expectSavedPlanUnchanged(page);
});

test('identifies a cold course route failure when the whole browser goes offline', async ({
	page,
	context
}) => {
	await seed(page);
	await page.goto(origin + previewUrl);
	const courseLink = page.getByRole('link').filter({ hasText: '01140052' });
	await expect(courseLink).toBeVisible();
	await expectCoursesReady(page);
	expect(
		(await resources(page)).some((entry) => entry.key === '/_courses/01140052')
	).toBe(false);
	const failures: { path: string; error: string | undefined }[] = [];
	const serverDataRequests: string[] = [];
	page.on('requestfailed', (request) => {
		failures.push({
			path: new URL(request.url()).pathname,
			error: request.failure()?.errorText
		});
	});
	page.on('request', (request) => {
		if (request.url().includes('/__data.json'))
			serverDataRequests.push(request.url());
	});
	// Unlike blockPublicData(), this also blocks lazy route JS, HTML and CSS.
	// No pointer interaction has occurred yet; the course route is still cold.
	await context.setOffline(true);
	expect(await page.evaluate(() => navigator.onLine)).toBe(false);
	await courseLink.click();
	await expect(page).toHaveURL(origin + '/app/course/01140052');
	await expect(
		page.getByRole('heading', {
			name: '500 - Unable to load this page',
			exact: true
		})
	).toBeVisible();
	await expect(
		page.getByText('Check your connection, then reload the page.')
	).toBeVisible();
	await expect(
		page.getByText('404 - Page Not Found', { exact: true })
	).toHaveCount(0);
	expect(
		failures.some(({ path }) => /^\/_app\/immutable\/.*\.js$/.test(path))
	).toBe(true);
	expect(serverDataRequests).toEqual([]);
	console.log('Cold offline course navigation:', JSON.stringify(failures));
});

test('reopens an exact previously visited course offline in the same document', async ({
	page,
	context,
	request
}) => {
	await seed(page);
	const course = await (
		await request.get(origin + '/_courses/01140052')
	).json();
	const about = course.about.trim().slice(0, 60);
	await page.goto(origin + previewUrl);
	const courseLink = page.getByRole('link').filter({ hasText: '01140052' });
	await expectCoursesReady(page);
	await courseLink.click();
	await expect(page.locator('main h1').first()).toContainText(course.name);
	await expect(page.locator('main')).toContainText(about);
	expect(
		(await courseSnapshot(page, true)).courses?.find(
			(record) => record.code === '01140052'
		)
	).toEqual(course);
	await page.goBack();
	await expect(courseLink).toBeVisible();
	const navigationRequests: string[] = [];
	page.on('request', (request) => {
		if (
			request.resourceType() === 'document' ||
			request.url().includes('/__data.json')
		)
			navigationRequests.push(request.url());
	});
	await context.setOffline(true);
	expect(await page.evaluate(() => navigator.onLine)).toBe(false);
	await courseLink.click();
	await expect(page).toHaveURL(origin + '/app/course/01140052');
	await expect(page.locator('main h1').first()).toContainText(course.name);
	await expect(page.locator('main')).toContainText(about);
	expect(navigationRequests).toEqual([]);
	await expectSavedPlanUnchanged(page);
});

for (const [language, notFound] of [
	['en', 'Page Not Found'],
	['he', 'הדף לא נמצא']
]) {
	test(`keeps actual missing routes as 404 in ${language}`, async ({
		page
	}) => {
		await seed(page, language);
		const response = await page.goto(origin + '/this-route-does-not-exist');
		expect(response?.status()).toBe(404);
		await expect(
			page.getByRole('heading', { name: `404 - ${notFound}`, exact: true })
		).toBeVisible();
	});
}

test('keeps unknown course IDs as code-only course placeholders', async ({
	page
}) => {
	await seed(page);
	const response = await page.goto(origin + '/app/course/99999999');
	expect(response?.status()).toBe(200);
	await expect(page.locator('main h1').first()).toContainText('99999999');
	await expect(
		page.getByText('404 - Page Not Found', { exact: true })
	).toHaveCount(0);
	await expectSavedPlanUnchanged(page);
});

for (const failure of ['denied', 'blocked', 'unresponsive'] as const) {
	test(`falls back to the network when the public IndexedDB cache is ${failure}`, async ({
		page
	}) => {
		await seed(page);
		await page.addInitScript((failure) => {
			const open = indexedDB.open.bind(indexedDB);
			indexedDB.open = (name, ...args) => {
				if (
					['degree-planner-public-data', 'degree-planner-courses'].includes(
						name
					)
				) {
					if (failure === 'denied')
						throw new DOMException('Denied for test', 'SecurityError');
					const request = {} as IDBOpenDBRequest;
					if (failure === 'blocked')
						queueMicrotask(() =>
							request.onblocked?.call(
								request,
								new IDBVersionChangeEvent('blocked')
							)
						);
					return request;
				}
				return open(name, ...args);
			};
		}, failure);
		await page.goto(origin + previewUrl);
		await expect(page.locator('main h1').first()).toContainText(
			'Computer Science',
			// A completely silent open exercises several bounded store timeouts.
			{ timeout: failure === 'unresponsive' ? 20000 : 10000 }
		);
		await expectSavedPlanUnchanged(page);
	});
}

test('reports a failed refresh while verified cached courses remain usable', async ({
	page
}) => {
	await seed(page);
	await page.goto(origin + '/app/course/02340141');
	await expectCoursesReady(page);
	await expect(page.locator('main h1')).toContainText('קומבינטוריקה');
	const before = await courseSnapshot(page);
	await page.route('**/courseData.json*', (route) => route.abort());
	await page.reload();
	await expect(page.locator('main h1')).toContainText('קומבינטוריקה');
	const status = page.getByTestId('pwa-status');
	await expect(status).toHaveAttribute('data-refresh-state', 'error', {
		timeout: 20000
	});
	const indicator = status.getByRole('button', {
		name: pwaMessages.en.errorDetails,
		exact: true
	});
	const documentIdentity = await page.evaluateHandle(() => document);
	const details = page.getByTestId('pwa-status-details');
	await expect(indicator).toHaveAttribute('aria-controls', 'offline-status');
	await expect(indicator).toHaveAttribute('aria-expanded', 'false');
	await expect(details).toBeHidden();
	await expect(status.locator('details, summary')).toHaveCount(0);
	await expect(indicator).toBeVisible();
	await indicator.focus();
	await indicator.press('Enter');
	await expect(indicator).toBeFocused();
	await expect(indicator).toHaveAttribute('aria-expanded', 'true');
	await expect(details).toBeVisible();
	await indicator.press('Space');
	await expect(indicator).toHaveAttribute('aria-expanded', 'false');
	await expect(details).toBeHidden();
	await indicator.press('Enter');
	await expect(details).toBeVisible();
	await expect(page).toHaveURL(origin + '/app/course/02340141');
	expect(
		await page.evaluate((original) => document === original, documentIdentity)
	).toBe(true);
	await expect(page.getByTestId('pwa-error-detail').first()).toHaveText(
		pwaMessages.en.cachedRefreshFailed
	);
	await expect(details).not.toContainText('/courseData.json');
	await expect(page.getByTestId('pwa-refresh-error')).toHaveText(
		pwaMessages.en.cachedRefreshFailed
	);
	expect(await courseSnapshot(page)).toEqual(before);
	await expectSavedPlanUnchanged(page);
	await page.unroute('**/courseData.json*');
	await status
		.getByRole('button', { name: pwaMessages.en.retry, exact: true })
		.click();
	await expect(status).toHaveAttribute('data-refresh-state', 'idle', {
		timeout: 20000
	});
	await expectCoursesReady(page);
	await expect(page.getByTestId('pwa-refresh-error')).toHaveCount(0);
	expect(
		await page.evaluate((original) => document === original, documentIdentity)
	).toBe(true);
	await documentIdentity.dispose();
	await expectSavedPlanUnchanged(page);
	await expect(page.locator('main h1')).toContainText('קומבינטוריקה');
});
