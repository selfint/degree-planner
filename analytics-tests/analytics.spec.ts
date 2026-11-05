import { expect, test, type Page } from '@playwright/test';
import { gunzipSync } from 'node:zlib';
import { initializeGuestStorage } from '../tests/helpers/student-guest-storage';
import { transcriptPdf } from '../tests/helpers/transcript-pdf';

const base = process.env.BASE_PATH ?? '/degree-planner';
const origin = 'http://127.0.0.1:4178';
const path = (route: string) => `${origin}${base}${route}`;
type Event = { event: string; properties: Record<string, unknown> };
const degree = ['2026_200', '00002330', 'SC00001356_CG00011002'];
const seed = {
	degree,
	semesters: Array.from({ length: 12 }, (_, i) =>
		i === 0 ? ['02340141'] : []
	),
	currentSemester: 0,
	exemptions: [],
	wishlist: []
};

async function ready(page: Page) {
	await expect(page.locator('.console-shell')).not.toHaveAttribute('inert', '');
	await expect(page.locator('.console-shell > main')).not.toHaveAttribute(
		'inert',
		''
	);
}
async function setup(page: Page, plan: unknown = seed) {
	const events: Event[] = [];
	const requests: string[] = [];
	await page.context().addInitScript(() => {
		// Real SDK deliberately excludes automated browsers; test only explicit capture.
		Object.defineProperty(navigator, 'webdriver', { get: () => false });
	});
	await page.context().addInitScript(initializeGuestStorage, {
		origin,
		language: 'en',
		seed: plan
	});
	await page.context().route('**/*', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (url.origin === origin) return route.continue();
		if (url.hostname === 'posthog.example.test') {
			requests.push(request.url());
			if (request.method() === 'POST') {
				const raw = request.postDataBuffer()!;
				let parsed;
				if (raw[0] === 0x1f && raw[1] === 0x8b)
					parsed = JSON.parse(gunzipSync(raw).toString());
				else {
					const text = raw.toString();
					try {
						parsed = JSON.parse(text);
					} catch {
						const data = new URLSearchParams(text).get('data')!;
						parsed = JSON.parse(Buffer.from(data, 'base64').toString());
					}
				}
				events.push(
					...(Array.isArray(parsed) ? parsed : (parsed.batch ?? [parsed]))
				);
			}
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: '{"status":1}'
			});
		}
		return route.abort('blockedbyclient');
	});
	const count = (event: string) =>
		events.filter((e) => e.event === event).length;
	return { events, requests, count };
}

test('landing funnel, stable browser identity and one pageview per completed SPA page', async ({
	page
}) => {
	const { events, requests, count } = await setup(page);
	await page.goto(path('/'));
	await expect.poll(() => count('$pageview')).toBe(1);
	expect(events[0].properties.page).toBe('landing');
	await page
		.getByRole('link', { name: 'Get Started', exact: true })
		.first()
		.click();
	await ready(page);
	await expect.poll(() => count('start_clicked')).toBe(1);
	await expect.poll(() => count('$pageview')).toBe(2);
	expect(events[1].properties.distinct_id).toBe(
		events[0].properties.distinct_id
	);
	await page.locator(`a[href="${base}/app/catalog"]`).first().click();
	await expect.poll(() => count('$pageview')).toBe(3);
	await page.goBack();
	await expect.poll(() => count('$pageview')).toBe(4);
	expect(
		events.filter((e) => e.event === '$pageview').map((e) => e.properties.page)
	).toEqual(['landing', 'plan', 'catalog', 'plan']);
	await page.reload();
	await ready(page);
	await expect.poll(() => count('$pageview')).toBe(5);
	expect(new Set(events.map((e) => e.properties.distinct_id)).size).toBe(1);
	expect(requests.every((url) => new URL(url).pathname === '/e/')).toBe(true);
});

test('course additions and share/copy click versus canceled and saved copy', async ({
	page
}) => {
	const { events, count } = await setup(page);
	await page.goto(path('/app/course/02340124'));
	await ready(page);
	const wishlist = page.getByRole('button', { name: 'Wish list', exact: true });
	await expect(wishlist).toBeEnabled();
	await wishlist.click();
	await expect.poll(() => count('course_added_to_wishlist')).toBe(1);
	await page.getByRole('button', { name: 'Plan', exact: true }).click();
	await expect.poll(() => count('course_added_to_semester')).toBe(1);
	await page.locator(`a[href="${base}/app/plan"]`).first().click();
	const popup = page.waitForEvent('popup');
	await page.locator('a.plan-share').click();
	const share = await popup;
	await share.waitForLoadState();
	await ready(share);
	await expect.poll(() => count('share_plan_clicked')).toBe(1);
	await expect
		.poll(
			() =>
				events.filter(
					(e) => e.event === '$pageview' && e.properties.page === 'share'
				).length
		)
		.toBe(1);
	share.once('dialog', (dialog) => dialog.dismiss());
	await share.getByRole('button', { name: 'Copy plan', exact: true }).click();
	await expect.poll(() => count('copy_plan_clicked')).toBe(1);
	expect(count('plan_copied')).toBe(0);
	share.once('dialog', (dialog) => dialog.accept());
	await share.getByRole('button', { name: 'Copy plan', exact: true }).click();
	await expect.poll(() => count('plan_copied')).toBe(1);
	expect(count('copy_plan_clicked')).toBe(2);
	expect(count('course_added_to_semester')).toBe(1);
	expect(JSON.stringify(events)).not.toMatch(
		/02340124|02340141|SC00001356|semesters|2026_200/
	);
});

test('private shared-plan URLs, referrer, queries and fragments never reach telemetry or SDK storage', async ({
	page
}) => {
	const { events, requests, count } = await setup(page);
	await page.goto(
		path(
			`/share/${degree.join('/')}?semesters=02340124~02340141&secret=PRIVATE_QUERY#PRIVATE_HASH`
		),
		{ referer: `${origin}/PRIVATE_REFERRER?private=SECRET` }
	);
	await ready(page);
	await expect.poll(() => count('$pageview')).toBe(1);
	expect(events[0].properties).toMatchObject({
		page: 'share',
		$pathname: `${base}/share`,
		$geoip_disable: true,
		$process_person_profile: false
	});
	expect(JSON.stringify(events)).not.toMatch(
		/PRIVATE|SECRET|02340124|02340141|2026_200|SC00001356|\$current_url|\$referrer|\$set/
	);
	const telemetryStorage = await page.evaluate(() => ({
		local: Object.entries(localStorage).filter(([key]) =>
			/analytics|posthog|^ph_/.test(key)
		),
		session: Object.entries(sessionStorage),
		cookies: document.cookie
	}));
	expect(JSON.stringify(telemetryStorage)).not.toMatch(
		/PRIVATE|SECRET|02340124|02340141|SC00001356|2026_200/
	);
	expect(telemetryStorage.local).toHaveLength(1);
	expect(telemetryStorage.local[0][0]).toBe('planit.analytics.browser-id.v1');
	expect(requests.every((url) => new URL(url).pathname === '/e/')).toBe(true);
});

test('valid transcript preview is distinct from saving; rejected files and cancellation never count as saves', async ({
	page
}) => {
	const { events, count } = await setup(page, {
		...seed,
		semesters: Array.from({ length: 12 }, () => [])
	});
	await page.goto(path('/app/settings'));
	await ready(page);
	const upload = page.locator('.upload-section');
	const input = upload.locator('input[type=file]');
	await input.setInputFiles({
		name: 'PRIVATE_BAD_FILE.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from('not a PDF')
	});
	await expect(upload.getByRole('alert')).toBeVisible();
	expect(count('grade_file_uploaded')).toBe(0);
	const file = {
		name: 'PRIVATE_GRADE_FILE.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from(transcriptPdf(['Winter 2025-2026', '02340124']))
	};
	await input.setInputFiles(file);
	await expect(
		upload.getByRole('button', { name: 'Save', exact: true })
	).toBeVisible();
	await expect.poll(() => count('grade_file_uploaded')).toBe(1);
	await upload.getByRole('button', { name: 'Cancel', exact: true }).click();
	expect(count('grade_import_saved')).toBe(0);
	await input.setInputFiles(file);
	await upload.getByRole('button', { name: 'Save', exact: true }).click();
	await expect.poll(() => count('grade_import_saved')).toBe(1);
	expect(count('grade_file_uploaded')).toBe(2);
	expect(JSON.stringify(events)).not.toMatch(/PRIVATE|02340124/);
});
