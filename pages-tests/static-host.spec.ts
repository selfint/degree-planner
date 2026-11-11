import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const course = JSON.parse(readFileSync('static/courseData.json', 'utf8'))[
	'02340124'
];
const base = process.env.BASE_PATH ?? '/degree-planner';
const origin = 'http://127.0.0.1:4178';
const path = (value: string) => `${base}${value}`;
const guest = {
	degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
	path: 'CG00006385',
	exemptions: [],
	semesters: [[], []],
	currentSemester: 0,
	wishlist: ['02340124']
};

// Match loadDegreeName's direct-child lookup before starting the browser tests.
const requirementsFile = `static/_catalogs/${guest.degree.join('/')}/requirementsData.json`;
const requirement: {
	nested?: { name: string; nested?: unknown[]; courses?: string[] }[];
} = JSON.parse(readFileSync(requirementsFile, 'utf8'));
const selectedPath = requirement.nested?.find(
	(node) => node.name === guest.path
);
if (
	!guest.path ||
	!selectedPath ||
	!((selectedPath.nested?.length ?? 0) + (selectedPath.courses?.length ?? 0))
) {
	throw new Error(
		`Pages guest fixture must select a nonempty direct path in ${requirementsFile}: ${guest.path}`
	);
}

test.beforeEach(async ({ page, context }) => {
	// Built production artifacts retain live GA configuration; QA never sends telemetry.
	await context.route('**/*', (route) =>
		new URL(route.request().url()).origin === origin
			? route.continue()
			: route.abort('blockedbyclient')
	);
	await page.addInitScript((guest) => {
		localStorage.setItem('lang', 'en');
		localStorage.setItem('version', '4');
		localStorage.setItem('userData', JSON.stringify(guest));
	}, guest);
});

test('static routes, data, manifest and worker have direct HTTP responses', async ({
	request
}) => {
	for (const route of [
		'/',
		'/app/',
		'/app/settings',
		'/app/plan',
		'/app/search',
		'/app/offline/',
		'/manifest.webmanifest',
		'/service-worker.js',
		'/catalogs.json',
		'/courseData.json',
		'/storybook/index.html',
		'/storybook/iframe.html'
	]) {
		const response = await request.get(path(route), { maxRedirects: 0 });
		expect(response.status(), route).toBe(200);
	}
	const manifest = await (
		await request.get(path('/manifest.webmanifest'))
	).json();
	const manifestURL = `${origin}${path('/manifest.webmanifest')}`;
	expect(new URL(manifest.id, origin).pathname).toBe(path('/'));
	expect(new URL(manifest.scope, manifestURL).pathname).toBe(path('/app/'));
	expect(new URL(manifest.start_url, manifestURL).pathname).toBe(path('/app/'));
	for (const icon of manifest.icons) {
		expect(
			(await request.get(new URL(icon.src, manifestURL).href)).status()
		).toBe(200);
	}
});

test('landing, plan, repeated tabs and history stay inside deployment prefix', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto(path('/'));
	await page
		.locator('main')
		.getByRole('link', { name: 'Get Started', exact: true })
		.click();
	await expect(page).toHaveURL(`${origin}${path('/app/plan')}`);
	await expect(page.locator('[data-code="02340124"]')).toBeVisible({
		timeout: 30_000
	});
	for (const route of ['catalog', 'settings', 'plan']) {
		await page.locator(`header a[href="${path(`/app/${route}`)}"]`).click();
		await expect(page).toHaveURL(`${origin}${path(`/app/${route}`)}`);
		await expect(page.locator('main')).toBeVisible();
	}
	await page.goBack();
	await expect(page).toHaveURL(`${origin}${path('/app/settings')}`);
	await page.goForward();
	await expect(page).toHaveURL(`${origin}${path('/app/plan')}`);
	await page.reload();
	await expect(page.locator('[data-code="02340124"]')).toBeVisible();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
	).toEqual(guest);
	expect(errors).toEqual([]);
});

test('cold dynamic and legacy links hydrate through the real 404 fallback', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const response = await page.goto(
		path('/app/course/02340124?source=pages#details')
	);
	expect(response?.status()).toBe(404);
	await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('#console-boot')).toBeHidden();
	await expect(page.locator('h1.course-name')).toHaveText(course.name);
	expect(page.url()).toContain(path('/app/course/02340124'));
	await page.goto(path('/settings?source=old-link#details'));
	await expect(page).toHaveURL(
		`${origin}${path('/app/settings?source=old-link#details')}`
	);
	await expect(page.locator('main')).toBeVisible();
	expect(errors).toEqual([]);
});

test('cold shared-plan URL preserves its browser route and actual preview content', async ({
	page
}) => {
	const share = `/share/${guest.degree.join('/')}?semesters=02340124&path=${guest.path}`;
	const response = await page.goto(path(share));
	expect(response?.status()).toBe(404);
	await expect(page.locator('.preview-page')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('.preview-course')).toContainText(course.name);
	await expect(page.locator('.preview-course')).toHaveAttribute(
		'href',
		path('/app/course/02340124')
	);
	expect(page.url()).toBe(`${origin}${path(share)}`);
	await page.reload();
	await expect(page.locator('.preview-course')).toContainText(course.name);
});

test('Storybook renders a real story and does not request root assets', async ({
	page
}) => {
	const badRequests: string[] = [];
	page.on('response', (response) => {
		if (response.url().startsWith(origin) && response.status() >= 400)
			badRequests.push(response.url());
	});
	await page.goto(
		path('/storybook/iframe.html?id=components-button--primary&viewMode=story')
	);
	await expect(page.locator('#storybook-root button').first()).toBeVisible({
		timeout: 30_000
	});
	expect(badRequests).toEqual([]);
});

test.describe('offline Pages artifact', () => {
	test.use({ serviceWorkers: 'allow' });
	test('installs a scoped worker and opens an unseen course offline', async ({
		page,
		context
	}) => {
		await page.goto(path('/app/settings'));
		await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
		await expect
			.poll(
				() =>
					page.evaluate(
						async () =>
							(await navigator.serviceWorker.getRegistration())?.active?.state
					),
				{ timeout: 30_000 }
			)
			.toBe('activated');
		const scope = await page.evaluate(
			async () => (await navigator.serviceWorker.getRegistration())?.scope
		);
		expect(scope).toBe(`${origin}${path('/app/')}`);
		await expect
			.poll(() =>
				page.evaluate(() => Boolean(navigator.serviceWorker.controller))
			)
			.toBe(true);
		await expect(page.getByTestId('pwa-status')).toHaveAttribute(
			'data-state',
			'ready',
			{ timeout: 30_000 }
		);
		await context.setOffline(true);
		await page.goto(path('/app/course/02340124'));
		await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
		await expect(page.locator('#console-boot')).toBeHidden();
		expect(page.url()).toContain(path('/app/course/02340124'));
		await expect(page.locator('h1.course-name')).toHaveText(course.name);
		await page.reload();
		await expect(page.locator('h1.course-name')).toHaveText(course.name);
		await expect(page.getByTestId('plan-read-only')).toBeVisible();
	});
});

test('historical three-year CS shared link resolves without rewriting the URL or saved guest', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const share =
		'/share/2024_200/00002120/SC00001320_CG00006382?semesters=02340124&path=CG00006246';
	const response = await page.goto(path(share));
	expect(response?.status()).toBe(404);
	await expect(page.locator('.preview-page')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('.preview-heading h1')).toContainText(
		'B.SC. IN COMPUTER SCIENCES (3 YEARS)'
	);
	await expect(page.locator('.preview-heading h1')).toContainText(
		'Path: Compter Science 3 Years'
	);
	await expect(page.locator('.preview-course')).toContainText(course.name);
	expect(page.url()).toBe(`${origin}${path(share)}`);
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
	).toEqual(guest);
	expect(errors).toEqual([]);
});
