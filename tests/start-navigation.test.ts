import { expect, test } from '@playwright/test';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

for (const region of [
	'header',
	'main',
	'[data-testid="landing-install-info"]'
]) {
	test(`${region} Start link works before JavaScript loads`, async ({
		page
	}) => {
		await page.route('**/_app/**/*.js', (route) => route.abort());
		await page.goto(origin);
		const start = page.locator(region).getByRole('link', {
			name:
				region === '[data-testid="landing-install-info"]'
					? /^(Open PlanIt|פתיחת PlanIt)$/
					: /^(Get Started|התחל)$/
		});
		await expect(start).toBeVisible();
		await start.click();
		await expect(page).toHaveURL(/\/app\/?$/);
	});
}

test('Start works with JavaScript disabled', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	try {
		const page = await context.newPage();
		await page.goto(origin);
		await page
			.locator('main')
			.getByRole('link', { name: /^(Get Started|התחל)$/ })
			.click();
		await expect(page).toHaveURL(/\/app\/?$/);
	} finally {
		await context.close();
	}
});

test('a stalled analytics IndexedDB check does not block hydration or Start', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('lang', 'en');
		const open = indexedDB.open.bind(indexedDB);
		indexedDB.open = (name, ...args) => {
			if (name === 'validate-browser-context-for-indexeddb-analytics-module') {
				// Simulate a probe whose callbacks never fire without stalling auth.
				return {} as IDBOpenDBRequest;
			}
			return open(name, ...args);
		};
	});
	await page.goto(origin);
	// A client-only language preference proves hydration has completed.
	const start = page.locator('main').getByRole('link', { name: 'Get Started' });
	await expect(start).toBeVisible();
	await start.click();
	await expect(page).toHaveURL(`${origin}/app/settings`);
	await expect(
		page.getByRole('heading', { name: 'Guest', exact: true })
	).toBeVisible();
});

test('blocked Firebase endpoints still allow a guest to start without losing their plan', async ({
	page
}) => {
	const guest = {
		exemptions: [],
		semesters: [['02340124'], []],
		currentSemester: 0,
		wishlist: ['02340141']
	};
	await page.addInitScript((guest) => {
		localStorage.setItem('lang', 'en');
		localStorage.setItem('version', '4');
		localStorage.setItem('userData', JSON.stringify(guest));
	}, guest);
	await page.route(
		/https:\/\/[^/]*(googleapis\.com|firebaseio\.com|firebaseapp\.com)\//,
		(route) => route.abort()
	);
	await page.goto(origin);
	await page.locator('main').getByRole('link', { name: 'Get Started' }).click();
	await expect(page).toHaveURL(`${origin}/app/settings`);
	await expect(
		page.getByRole('heading', { name: 'Guest', exact: true })
	).toBeVisible();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
	).toEqual(guest);
});

test('repeated clicks keep one settings history entry and support Back/Forward', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.goto(origin);
	const start = page.locator('main').getByRole('link', { name: 'Get Started' });
	await expect(start).toBeVisible();
	// Dispatch both clicks before the first navigation can unmount the landing page.
	await start.evaluate((element) => {
		(element as HTMLAnchorElement).click();
		(element as HTMLAnchorElement).click();
	});
	await expect(page).toHaveURL(`${origin}/app/settings`);
	await page.goBack();
	await expect(page).toHaveURL(`${origin}/`);
	await page.goForward();
	await expect(page).toHaveURL(`${origin}/app/settings`);
});

test('a keyboard click shows the console boot screen while route scripts are slow', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('lang', 'en'));
	await page.goto(origin);
	// Hold only the destination route, after initial hydration finishes.
	const start = page.locator('main').getByRole('link', { name: 'Get Started' });
	await expect(start).toBeVisible();
	let resume!: () => void;
	const pending = new Promise<void>((resolve) => {
		resume = resolve;
	});
	await page.route('**/_app/immutable/nodes/*.js', async (route) => {
		await pending;
		await route.continue();
	});
	await start.focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('#console-boot')).toBeVisible();
	resume();
	await expect(page).toHaveURL(`${origin}/app/settings`);
});
