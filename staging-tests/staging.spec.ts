import { expect, test } from '@playwright/test';

const base = process.env.BASE_PATH ?? '/degree-planner';
const origin = 'http://127.0.0.1:4178';
const staging = `${base}/staging`;
const guest = {
	degree: ['2026_200', '00002330', 'SC00001356_CG00011002'],
	exemptions: [],
	semesters: [[], []],
	currentSemester: 0,
	wishlist: []
};
const telemetry =
	/posthog|google-analytics|googletagmanager|firebaseinstallations|\/_vercel\/|vitals\.vercel|va\.vercel/i;

test.beforeEach(async ({ context }) => {
	// Never sign in or write real account data during artifact QA. Firebase config
	// and auth persistence are covered separately by the service unit tests.
	await context.route('**/*', (route) => {
		const url = new URL(route.request().url());
		return url.origin === origin && !telemetry.test(url.href)
			? route.continue()
			: route.abort('blockedbyclient');
	});
	await context.addInitScript(
		({ guest, origin }) => {
			if (location.origin !== origin || localStorage.getItem('staging-fixture'))
				return;
			localStorage.setItem('staging-fixture', '1');
			for (const prefix of ['', 'planit.staging.']) {
				localStorage.setItem(`${prefix}lang`, 'en');
				localStorage.setItem(`${prefix}version`, '4');
				localStorage.setItem(`${prefix}userData`, JSON.stringify(guest));
			}
		},
		{ guest, origin }
	);
});

test('staging stays analytics-free through landing, actions, reload and history with configured keys', async ({
	page
}) => {
	const requests: string[] = [];
	const errors: string[] = [];
	page.on('request', (request) => {
		if (telemetry.test(request.url())) requests.push(request.url());
	});
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto(`${staging}/`);
	await expect(page.getByTestId('staging-banner')).toContainText(
		'Analytics off'
	);
	await expect(page.getByTestId('staging-banner')).toContainText(
		'Saving here changes your real plan'
	);
	await page
		.locator('main')
		.getByRole('link', { name: 'Get Started', exact: true })
		.click();
	await expect(page).toHaveURL(`${origin}${staging}/app/plan`);
	await expect(page.getByTestId('staging-banner')).toBeVisible();
	await page.goto(`${staging}/app/course/02340124?private=test#details`);
	await expect(page.locator('h1.course-name')).toBeVisible({ timeout: 30_000 });
	await page.getByRole('button', { name: 'Wish list', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					JSON.parse(localStorage.getItem('planit.staging.userData')!).wishlist
			)
		)
		.toContain('02340124');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
	).toEqual(guest);
	await page.reload();
	await expect(page.locator('h1.course-name')).toBeVisible();
	await page.locator(`header a[href="${staging}/app/settings"]`).click();
	await page.goBack();
	await expect(page.locator('h1.course-name')).toBeVisible();
	// Optional instrumentation is delayed by 1500ms; cover its complete window.
	await page.waitForTimeout(2000);
	expect(requests).toEqual([]);
	expect(errors).toEqual([]);
	expect(
		await page.evaluate(() =>
			Object.keys(localStorage).filter((key) =>
				/analytics|posthog|^ph_/.test(key)
			)
		)
	).toEqual([]);
});

test('site-wide 404 selects staging before boot and preserves shared-plan URL', async ({
	page
}) => {
	const requests: string[] = [];
	page.on('request', (request) => {
		if (telemetry.test(request.url())) requests.push(request.url());
	});
	const url = `${origin}${staging}/share/${guest.degree.join('/')}?semesters=02340124&private=KEEP#fragment`;
	expect((await page.goto(url))?.status()).toBe(404);
	await expect(page.locator('.preview-course')).toBeVisible({
		timeout: 30_000
	});
	await expect(page.getByTestId('staging-banner')).toBeVisible();
	expect(page.url()).toBe(url);
	await expect(page.locator('.preview-course')).toHaveAttribute(
		'href',
		`${staging}/app/course/02340124`
	);
	await page.reload();
	await expect(page.locator('.preview-course')).toBeVisible();
	expect(page.url()).toBe(url);
	await page.waitForTimeout(2000);
	expect(requests).toEqual([]);
});

test('production remains unmarked and both manifests keep disjoint installation scopes', async ({
	page,
	request
}) => {
	await page.goto(`${base}/`);
	await expect(page.locator('main')).toBeVisible();
	await expect(page.getByTestId('staging-banner')).toHaveCount(0);
	for (const prefix of [base, staging]) {
		const url = `${origin}${prefix}/manifest.webmanifest`;
		const manifest = await (await request.get(url)).json();
		expect(new URL(manifest.id, origin).pathname).toBe(`${prefix}/`);
		expect(new URL(manifest.start_url, url).pathname).toBe(`${prefix}/app/`);
		expect(new URL(manifest.scope, url).pathname).toBe(`${prefix}/app/`);
		expect(manifest.name).toBe(
			prefix === staging ? 'PlanIt Staging' : 'PlanIt - Technion Degree Planner'
		);
	}
});

test.describe('separate installed apps', () => {
	test.use({ serviceWorkers: 'allow' });
	test('keeps production and staging workers and caches separate across offline navigation', async ({
		page,
		context
	}) => {
		for (const prefix of [base, staging]) {
			await page.goto(`${prefix}/app/settings`);
			await expect(page.getByTestId('pwa-status')).toHaveAttribute(
				'data-state',
				'ready',
				{ timeout: 30_000 }
			);
			expect(
				await page.evaluate(
					async () => (await navigator.serviceWorker.getRegistration())?.scope
				)
			).toBe(`${origin}${prefix}/app/`);
		}
		const registrations = await page.evaluate(async () =>
			(await navigator.serviceWorker.getRegistrations()).map((reg) => reg.scope)
		);
		expect(registrations.sort()).toEqual(
			[`${origin}${base}/app/`, `${origin}${staging}/app/`].sort()
		);
		const caches = await page.evaluate(async () => window.caches.keys());
		for (const prefix of [base, staging])
			expect(
				caches.some((key) =>
					key.startsWith(
						`planit-console-shell-${prefix ? `${encodeURIComponent(prefix)}-` : ''}`
					)
				)
			).toBe(true);
		await context.setOffline(true);
		await page.goto(`${staging}/app/course/02340124`);
		await expect(page.locator('h1.course-name')).toBeVisible({
			timeout: 30_000
		});
		await expect(page.getByTestId('staging-banner')).toBeVisible();
		await expect(page.getByTestId('plan-read-only')).toBeVisible();
	});
});
