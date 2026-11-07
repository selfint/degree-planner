import { expect, test, type Page } from '@playwright/test';

// Synthetic account only. Hold each Firebase adapter read until the test
// explicitly resolves/rejects it; never contact a real account or cloud store.
const adapter = `
const listeners = new Set();
const reads = [];
const auth = {
 currentUser: {uid: 'synthetic-account'},
 onAuthStateChanged(fn) { listeners.add(fn); queueMicrotask(() => fn(auth.currentUser)); return () => listeners.delete(fn); },
 signOut() { window.accountFixture.auth(null); }
};
window.accountFixture = {
 reads,
 auth(uid) { auth.currentUser = uid ? {uid} : null; listeners.forEach(fn => fn(auth.currentUser)); },
 finish(index, fail = false) { const read = reads[index]; if (fail) read.reject(new Error('controlled failure')); else read.resolve({version:4, semesters:[[]], wishlist:[], exemptions:[], currentSemester:0}); }
};
export async function initFirebase() { return {auth}; }
export function buildFirebaseStorage() { return {read: () => new Promise((resolve,reject) => reads.push({resolve,reject})), write: async () => {throw new Error('Unexpected write');}}; }
export function subscribeFirebase() { return () => {}; }
export async function startOptionalAnalytics() {}
export async function signIn() {}
`;
async function command(page: Page, script: string) {
	await page.evaluate(script);
}
async function prepare(page: Page, lang = 'en') {
	await page.route('**/src/lib/firebase.svelte.ts*', (route) =>
		route.fulfill({ contentType: 'text/javascript', body: adapter })
	);
	await page.route(
		/https:\/\/(?:[^/]*google[^/]*|[^/]*firebase[^/]*|[^/]*vercel[^/]*)\//,
		(route) => route.abort()
	);
	await page.addInitScript((lang) => {
		localStorage.setItem('lang', lang);
		localStorage.setItem('theme', 'dark');
		localStorage.setItem('version', '4');
		localStorage.setItem(
			'userData',
			JSON.stringify({
				version: 4,
				semesters: [['02340124']],
				wishlist: [],
				exemptions: [],
				currentSemester: 0
			})
		);
	}, lang);
	await page.goto('/app/plan');
	await expect(page.getByTestId('account-loading')).toBeVisible();
}
async function pending(page: Page) {
	await expect(page.getByTestId('account-loading')).toBeVisible();
	await expect(page.getByTestId('pwa-account-unavailable')).toHaveCount(0);
	await expect(page.locator('main')).toBeHidden();
	const footer = await page.locator('footer').boundingBox();
	expect(footer!.y).toBeGreaterThan(600);
}
for (const lang of ['en', 'he']) {
	test(`${lang}: delayed account load and repeated reload preserve guest data and stable footer`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await prepare(page, lang);
		const guest = await page.evaluate(() => localStorage.getItem('userData'));
		for (let attempt = 0; attempt < 2; attempt++) {
			if (attempt) await page.reload();
			await pending(page);
			await page.waitForTimeout(2500);
			await pending(page);
			await command(page, 'window.accountFixture.finish(0)');
			await expect(page.getByTestId('account-loading')).toHaveCount(0);
			await expect(page.locator('main')).toBeVisible();
			await expect(page.getByTestId('pwa-account-unavailable')).toHaveCount(0);
			expect(await page.evaluate(() => localStorage.getItem('userData'))).toBe(
				guest
			);
		}
		await page.locator('footer').scrollIntoViewIfNeeded();
		await expect(page.locator('.footer-author')).toHaveCSS(
			'font-weight',
			'500'
		);
		await expect(page.locator('.footer-report')).toHaveCSS(
			'text-decoration-line',
			'underline'
		);
		await page.waitForTimeout(1500);
	});
}
test('actual failure, retry, interrupted auth, stale success and stale failure', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await prepare(page);
	await command(page, 'window.accountFixture.finish(0, true)');
	await expect(page.getByTestId('pwa-account-unavailable')).toBeVisible();
	// The development server also exposes the PWA setup retry in the footer.
	// Exercise the account retry, not an unrelated button with the same label.
	await page
		.getByTestId('pwa-account-unavailable')
		.getByRole('button', { name: 'Try again', exact: true })
		.click();
	await pending(page);
	await command(page, "window.accountFixture.auth('second-account')");
	await command(page, 'window.accountFixture.finish(1)');
	await pending(page);
	await command(page, "window.accountFixture.auth('third-account')");
	await command(page, 'window.accountFixture.finish(2, true)');
	await pending(page);
	await command(page, 'window.accountFixture.finish(3)');
	await expect(page.locator('main')).toBeVisible();
	await command(page, "window.accountFixture.auth('fourth-account')");
	await pending(page);
	await command(page, 'window.accountFixture.auth(null)');
	await expect(page.locator('main')).toBeVisible();
	await command(page, 'window.accountFixture.finish(4, true)');
	await expect(page.locator('main')).toBeVisible();
	await expect(page.getByTestId('pwa-account-unavailable')).toHaveCount(0);
});
