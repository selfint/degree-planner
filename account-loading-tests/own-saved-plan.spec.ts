import { expect, test } from '@playwright/test';

const saved = {
	semesters: [['02340141']],
	wishlist: [],
	exemptions: [],
	currentSemester: 0
};
const adapter = `
import {markPersistedPlan} from '/src/lib/ownSavedPlanView.ts';
const listeners = new Set(); const reads = [];
const auth = {currentUser:{uid:'synthetic'}, onAuthStateChanged(fn){listeners.add(fn);return ()=>listeners.delete(fn);}, signOut(){window.planFixture.auth(null);}};
window.planFixture = {
 reads, get listening(){return listeners.size;},
 auth(user){auth.currentUser=user;listeners.forEach(fn=>fn(user));},
 finish(data, persisted=true){reads.shift().resolve(persisted?markPersistedPlan(data):data);},
 fail(){reads.shift().reject(new Error('controlled failure'));}
};
export async function initFirebase(){return {auth};}
export function buildFirebaseStorage(){return {read:()=>new Promise((resolve,reject)=>reads.push({resolve,reject})),write:async(data)=>data};}
export function subscribeFirebase(){return ()=>{};}
export async function startOptionalAnalytics(){}
export async function signIn(){}
`;
const analytics = `
window.planEvents=[];
export function trackEvent(event){window.planEvents.push(event);}
export function trackPageView(){}
export function trackFirstDegreeSelection(){}
export function trackCourseAdditions(){}
export function trackCourseMoves(){}
`;
async function count(page: import('@playwright/test').Page) {
	return page.evaluate(
		() =>
			((window as unknown as { planEvents: string[] }).planEvents ?? []).filter(
				(e) => e === 'own_saved_plan_viewed'
			).length
	);
}
test.beforeEach(async ({ page }) => {
	await page.route('**/*', (route) =>
		new URL(route.request().url()).origin === 'http://localhost:5173'
			? route.continue()
			: route.abort()
	);
	await page.route('**/src/lib/firebase.svelte.ts*', (route) =>
		route.fulfill({ contentType: 'text/javascript', body: adapter })
	);
	await page.route('**/src/lib/analytics.ts*', (route) =>
		route.fulfill({ contentType: 'text/javascript', body: analytics })
	);
	await page.addInitScript((saved) => {
		localStorage.setItem('version', '4');
		localStorage.setItem('userData', JSON.stringify(saved));
		localStorage.setItem('lang', 'en');
	}, saved);
});
for (const [name, data, persisted, expected] of [
	['saved account', saved, true, 1],
	['pending write', saved, false, 0],
	['empty account', { ...saved, semesters: [[]] }, true, 0]
] as const) {
	test(`${name}: waits for auth/account display and excludes cached guest data`, async ({
		page
	}) => {
		await page.goto('/app/plan');
		await page.waitForFunction(
			() =>
				(window as unknown as { planFixture?: { listening: number } })
					.planFixture?.listening
		);
		expect(await count(page)).toBe(0);
		await page.evaluate('window.planFixture.auth({uid:"synthetic"})');
		await page.waitForFunction(
			() =>
				(window as unknown as { planFixture: { reads: unknown[] } }).planFixture
					.reads.length === 1
		);
		expect(await count(page)).toBe(0);
		await page.evaluate(
			({ data, persisted }) => {
				(
					window as unknown as {
						planFixture: {
							finish: (data: unknown, persisted: boolean) => void;
						};
					}
				).planFixture.finish(data, persisted);
			},
			{ data, persisted }
		);
		await expect(page.locator('.console-shell > main')).not.toHaveAttribute(
			'inert',
			''
		);
		await expect(page.locator('.console-shell')).not.toHaveAttribute(
			'inert',
			''
		);
		if (expected) await expect.poll(() => count(page)).toBe(1);
		await page.locator('a[href="/app/catalog"]').first().click();
		expect(await count(page)).toBe(expected);
	});
}
test('failed account load never counts guest fallback; retry then return counts saved displays', async ({
	page
}) => {
	await page.goto('/app/plan');
	await page.waitForFunction(
		() =>
			(window as unknown as { planFixture?: { listening: number } }).planFixture
				?.listening
	);
	await page.evaluate('window.planFixture.auth({uid:"synthetic"})');
	await page.waitForFunction(
		() =>
			(window as unknown as { planFixture: { reads: unknown[] } }).planFixture
				.reads.length === 1
	);
	await page.evaluate('window.planFixture.fail()');
	await expect(page.locator('.console-shell > main')).toHaveAttribute(
		'inert',
		''
	);
	expect(await count(page)).toBe(0);
	await page
		.getByTestId('pwa-account-unavailable')
		.getByRole('button', { name: 'Try again', exact: true })
		.click();
	await page.evaluate(
		(data) =>
			(
				window as unknown as {
					planFixture: { finish: (data: unknown) => void };
				}
			).planFixture.finish(data),
		saved
	);
	await expect.poll(() => count(page)).toBe(1);
	await page.locator('a[href="/app/catalog"]').first().click();
	await expect(page).toHaveURL(/\/app\/catalog$/);
	await page.goBack();
	await expect(page).toHaveURL(/\/app\/plan$/);
	await expect.poll(() => count(page)).toBe(2);
});

test('unsaved in-memory data and a first save do not retroactively qualify the visit', async ({
	page
}) => {
	await page.goto('/app/plan');
	await page.waitForFunction(
		() =>
			(window as unknown as { planFixture?: { listening: number } }).planFixture
				?.listening
	);
	await page.evaluate('window.planFixture.auth({uid:"synthetic"})');
	await page.waitForFunction(
		() =>
			(window as unknown as { planFixture: { reads: unknown[] } }).planFixture
				.reads.length === 1
	);
	await page.evaluate(
		(data) =>
			(
				window as unknown as {
					planFixture: { finish: (data: unknown) => void };
				}
			).planFixture.finish(data),
		{ ...saved, semesters: [[]] }
	);
	await expect(page.locator('.console-shell')).not.toHaveAttribute('inert', '');
	await page.evaluate(async (data) => {
		const modulePath = '/src/lib/stores.svelte.ts';
		const { setUser } = await import(modulePath);
		setUser(data);
	}, saved);
	await expect(page.locator('[data-semester="0"] .course-card')).toBeVisible();
	expect(await count(page)).toBe(0);
	await page.locator('a[href="/app/catalog"]').first().click();
	await expect(page).toHaveURL(/\/app\/catalog$/);
	await page.goBack();
	await expect(page).toHaveURL(/\/app\/plan$/);
	await expect(page.locator('[data-semester="0"] .course-card')).toBeVisible();
	expect(await count(page)).toBe(0);
	await page.evaluate(async (data) => {
		const modulePath = '/src/lib/stores.svelte.ts';
		const { setUser, writeStorage } = await import(modulePath);
		setUser(await writeStorage(data));
	}, saved);
	expect(await count(page)).toBe(0);
	await page.locator('a[href="/app/catalog"]').first().click();
	await expect(page).toHaveURL(/\/app\/catalog$/);
	await page.goBack();
	await expect(page).toHaveURL(/\/app\/plan$/);
	await expect.poll(() => count(page)).toBe(1);
});
