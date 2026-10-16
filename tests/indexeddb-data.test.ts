import { expect, test, type Page } from '@playwright/test';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];
const programUrl = `/_catalogs/${degree.join('/')}/requirementsData.json`;
const previewUrl = `/preview/${degree.join('/')}?path=CG00006253&semesters=01140052~00104031`;
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
	test(`reloads cached course/catalog/requirements in ${language} with all public data requests blocked`, async ({
		page,
		request
	}) => {
		await seed(page, language);
		const requirement = await (await request.get(origin + programUrl)).json();
		const courses = await (
			await request.get(origin + '/courseDataStripped.json')
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
				'/catalogs.json',
				'/courseDataStripped.json'
			]);
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
		expect(
			await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
		).toEqual(savedPlan);
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

test('keeps full course data and per-course details across reloads', async ({
	page,
	request
}) => {
	await seed(page);
	const course = await (
		await request.get(origin + '/_courses/01140052')
	).json();
	expect(course.about.trim().length).toBeGreaterThan(20);
	const about = course.about.trim().slice(0, 60);
	await page.goto(origin + '/search');
	await expect
		.poll(async () =>
			(await resources(page)).some((entry) => entry.key === '/courseData.json')
		)
		.toBe(true);
	await page.goto(origin + '/course/01140052');
	await expect
		.poll(async () =>
			(await resources(page)).some(
				(entry) => entry.key === '/_courses/01140052'
			)
		)
		.toBe(true);
	await expect(page.locator('main h1').first()).toContainText(course.name);
	await blockPublicData(page);
	await page.reload();
	await expect(page.locator('main h1').first()).toContainText(course.name);
	await expect(page.locator('main')).toContainText(about);
	const cached = (await resources(page)).find(
		(entry) => entry.key === '/_courses/01140052'
	);
	expect(cached?.data).toMatchObject({ code: '01140052' });
	await page.goto(origin + '/search?q=01140052');
	await expect(page.locator('main')).toContainText(course.name);
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
	).toEqual(savedPlan);
});

test('identifies a cold course route failure when the whole browser goes offline', async ({
	page,
	context
}) => {
	await seed(page);
	await page.goto(origin + previewUrl);
	const courseButton = page.locator('button').filter({ hasText: '01140052' });
	await expect(courseButton).toBeVisible();
	await expect
		.poll(async () =>
			(await resources(page)).some(
				(entry) => entry.key === '/courseDataStripped.json'
			)
		)
		.toBe(true);
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
	// Preview cards are buttons, so hovering them does not preload the course route.
	await context.setOffline(true);
	expect(await page.evaluate(() => navigator.onLine)).toBe(false);
	await courseButton.click();
	await expect(page).toHaveURL(origin + '/course/01140052');
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
	const courseButton = page.locator('button').filter({ hasText: '01140052' });
	await expect
		.poll(async () =>
			(await resources(page)).some(
				(entry) => entry.key === '/courseDataStripped.json'
			)
		)
		.toBe(true);
	await courseButton.click();
	await expect(page.locator('main h1').first()).toContainText(course.name);
	await expect(page.locator('main')).toContainText(about);
	await expect
		.poll(async () =>
			(await resources(page)).some(
				(entry) => entry.key === '/_courses/01140052'
			)
		)
		.toBe(true);
	await page.goBack();
	await expect(courseButton).toBeVisible();
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
	await courseButton.click();
	await expect(page).toHaveURL(origin + '/course/01140052');
	await expect(page.locator('main h1').first()).toContainText(course.name);
	await expect(page.locator('main')).toContainText(about);
	expect(navigationRequests).toEqual([]);
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
	).toEqual(savedPlan);
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
	const response = await page.goto(origin + '/course/99999999');
	expect(response?.status()).toBe(200);
	await expect(page.locator('main h1').first()).toContainText('99999999');
	await expect(
		page.getByText('404 - Page Not Found', { exact: true })
	).toHaveCount(0);
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
	).toEqual(savedPlan);
});

for (const failure of ['denied', 'blocked'] as const) {
	test(`falls back to the network when the public IndexedDB cache is ${failure}`, async ({
		page
	}) => {
		await seed(page);
		await page.addInitScript((failure) => {
			const open = indexedDB.open.bind(indexedDB);
			indexedDB.open = (name, ...args) => {
				if (name === 'degree-planner-public-data') {
					if (failure === 'denied')
						throw new DOMException('Denied for test', 'SecurityError');
					return {} as IDBOpenDBRequest;
				}
				return open(name, ...args);
			};
		}, failure);
		await page.goto(origin + previewUrl);
		await expect(page.locator('main h1').first()).toContainText(
			'Computer Science',
			{ timeout: 10000 }
		);
		expect(
			await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
		).toEqual(savedPlan);
	});
}
