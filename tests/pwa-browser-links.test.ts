import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;
const degree = ['2024_200', '00002120', 'SC00001320_CG00006382'];
const owner = {
	degree,
	semesters: [['01040031'], ['02340124'], []],
	currentSemester: 0,
	exemptions: [],
	wishlist: ['02340141']
};
const recipient = {
	degree,
	semesters: [['02340114'], ['01040184'], []],
	currentSemester: 1,
	exemptions: [],
	wishlist: ['02340124', '02340141']
};

test.use({ serviceWorkers: 'block' });
test.setTimeout(90_000);

async function prepare(context: BrowserContext, plan = owner) {
	await context.addInitScript(
		({ origin, plan }) => {
			if (location.origin !== origin || localStorage.getItem('userData'))
				return;
			localStorage.setItem('lang', 'en');
			localStorage.setItem('version', '4');
			localStorage.setItem('userData', JSON.stringify(plan));
		},
		{ origin, plan }
	);
	await context.route('**/*', (route) =>
		new URL(route.request().url()).origin === origin
			? route.continue()
			: route.abort()
	);
}

async function readPlan(page: Page) {
	return page.evaluate(() => JSON.parse(localStorage.getItem('userData')!));
}

test('Share opens an out-of-scope read-only preview and imports only into an independent guest', async ({
	page,
	context,
	browser
}) => {
	await prepare(context);
	await page.goto(`${origin}/app/plan`);
	const share = page.getByRole('link', { name: 'Share', exact: true });
	await expect(share).toBeVisible({ timeout: 30_000 });
	await expect(share).toHaveAttribute('href', /^\/share\//);
	await expect(share).toHaveAttribute('target', '_blank');
	await expect(share).toHaveAttribute('rel', /noopener/);

	const popupPromise = page.waitForEvent('popup');
	await share.click();
	const preview = await popupPromise;
	await expect(preview.locator('.preview-page')).toBeVisible({
		timeout: 30_000
	});
	const sharedUrl = preview.url();
	expect(new URL(sharedUrl).pathname).toBe(`/share/${degree.join('/')}`);
	await expect(preview.locator('header.title-bar')).toHaveCount(1);
	await expect(preview.locator('main')).toHaveCount(1);
	await expect(preview.locator('.preview-semester')).toHaveCount(3);
	expect(await preview.evaluate(() => window.opener === null)).toBe(true);
	await expect(page).toHaveURL(`${origin}/app/plan`);
	expect(await readPlan(page)).toEqual(owner);
	await preview.reload();
	await expect(preview.locator('.preview-page')).toBeVisible({
		timeout: 30_000
	});
	await expect(preview).toHaveURL(sharedUrl);
	expect(await readPlan(preview)).toEqual(owner);

	const independent = await browser.newContext({ serviceWorkers: 'block' });
	try {
		await prepare(independent, recipient);
		const receiver = await independent.newPage();
		await receiver.goto(sharedUrl);
		const copy = receiver.getByRole('button', {
			name: 'Copy plan',
			exact: true
		});
		await expect(copy).toBeVisible({ timeout: 30_000 });
		expect(await readPlan(receiver)).toEqual(recipient);
		receiver.once('dialog', (dialog) => dialog.dismiss());
		await copy.click();
		await expect(receiver).toHaveURL(sharedUrl);
		expect(await readPlan(receiver)).toEqual(recipient);
		receiver.once('dialog', (dialog) => dialog.accept());
		await copy.click();
		await expect(receiver).toHaveURL(`${origin}/app/plan`);
		await expect
			.poll(() => readPlan(receiver))
			.toEqual({
				...recipient,
				semesters: owner.semesters,
				wishlist: ['02340141']
			});
		expect(await readPlan(page)).toEqual(owner);
	} finally {
		await independent.close();
		await preview.close();
	}
});

for (const installedSignal of ['display-mode', 'ios-standalone'] as const) {
	test(`${installedSignal}: Share and logo request native out-of-scope navigation, not an app-owned popup`, async ({
		page,
		context
	}) => {
		await prepare(context);
		await context.addInitScript((signal) => {
			if (signal === 'ios-standalone') {
				Object.defineProperty(navigator, 'standalone', { value: true });
			} else {
				const original = window.matchMedia.bind(window);
				window.matchMedia = (query) => {
					const media = original(query);
					if (query === '(display-mode: standalone)')
						Object.defineProperty(media, 'matches', { value: true });
					return media;
				};
			}
		}, installedSignal);
		await page.goto(`${origin}/app/plan`);
		const share = page.getByRole('link', { name: 'Share', exact: true });
		const logo = page.locator('header.title-bar a.brand');
		await expect(share).toBeVisible({ timeout: 30_000 });
		await expect(share).toHaveAttribute('target', '_self');
		await expect(logo).toHaveAttribute('target', '_self');
		await expect(logo).toHaveAttribute('href', '/');
		await expect(share).toHaveAttribute('data-sveltekit-reload', '');
		await expect(logo).toHaveAttribute('data-sveltekit-reload', '');
		const popups: Page[] = [];
		page.on('popup', (popup) => popups.push(popup));
		await share.click();
		await expect(page).toHaveURL(new RegExp(`${origin}/share/`));
		await expect(page.locator('.preview-page')).toBeVisible({
			timeout: 30_000
		});
		expect(popups).toHaveLength(0);
		expect(await readPlan(page)).toEqual(owner);
		// This checks app intent only. Desktop emulation cannot verify the iOS
		// OS handoff, which may display Safari View Controller rather than Safari.
	});
}

test('the logo opens the landing in a new browser tab without moving the plan', async ({
	page,
	context
}) => {
	await prepare(context);
	await page.goto(`${origin}/app/plan`);
	const logo = page.locator('header.title-bar a.brand');
	await expect(logo).toHaveAttribute('target', '_blank');
	const popupPromise = page.waitForEvent('popup');
	await logo.click();
	const landing = await popupPromise;
	await expect(landing).toHaveURL(`${origin}/`);
	await expect(landing.locator('header.title-bar:not(.console)')).toBeVisible();
	const geometry = await landing
		.locator('header.title-bar')
		.evaluate((header) => {
			const logo = header.querySelector('.brand-logo')!.getBoundingClientRect();
			return {
				width: logo.width,
				height: logo.height,
				header: header.getBoundingClientRect().height
			};
		});
	expect(geometry.width).toBeCloseTo(44 * 1.05, 1);
	expect(geometry.height).toBeCloseTo(44 * 1.05, 1);
	expect(geometry.header).toBeCloseTo(72, 1);
	await expect(page).toHaveURL(`${origin}/app/plan`);
	expect(await readPlan(page)).toEqual(owner);
	await landing.close();
});

test.describe('browser preview entry with an existing service worker', () => {
	test.use({ serviceWorkers: 'allow' });
	test('Plan, search, and import enter controlled app documents without losing saved data', async ({
		page,
		context
	}) => {
		test.setTimeout(180_000);
		await prepare(context, recipient);
		await page.goto(`${origin}/app/plan`);
		const controlledAndReady = async () => {
			await page.waitForFunction(
				() => Boolean(navigator.serviceWorker.controller),
				undefined,
				{ timeout: 60_000 }
			);
			await expect(page.getByTestId('pwa-status')).toContainText(
				'All courses ready offline',
				{ timeout: 60_000 }
			);
			await expect(page.getByTestId('pwa-error')).toHaveCount(0);
		};
		await controlledAndReady();
		const sharedUrl = `${origin}/share/${degree.join('/')}?semesters=${encodeURIComponent(owner.semesters.map((semester) => semester.join('-')).join('~'))}`;
		const openUncontrolledPreview = async () => {
			await page.goto(sharedUrl);
			await expect(page.locator('.preview-page')).toBeVisible({
				timeout: 30_000
			});
			expect(
				await page.evaluate(() => navigator.serviceWorker.controller)
			).toBeNull();
			expect(
				await page.evaluate(async () =>
					Boolean(
						(await navigator.serviceWorker.getRegistration('/app/'))?.active
					)
				)
			).toBe(true);
			for (const id of [
				'pwa-footer-row',
				'pwa-status',
				'pwa-status-details',
				'pwa-update-banner',
				'footer-update'
			])
				await expect(page.getByTestId(id)).toHaveCount(0);
			await expect(page.getByTestId('footer-build-version')).toBeVisible();
			await expect(page.getByTestId('footer-build-version')).not.toHaveText('');
			return page.evaluate(() => performance.timeOrigin);
		};
		let previousDocument = await openUncontrolledPreview();
		await page.locator('header nav a[href="/app/plan"]').click();
		await expect(page).toHaveURL(`${origin}/app/plan`);
		await controlledAndReady();
		expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(
			previousDocument
		);
		expect(await readPlan(page)).toEqual(recipient);

		previousDocument = await openUncontrolledPreview();
		await page.locator('.header-search input').fill('02340124');
		await page.locator('.header-search input').press('Enter');
		await expect(page).toHaveURL(`${origin}/app/search?q=02340124`);
		await controlledAndReady();
		expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(
			previousDocument
		);
		expect(await readPlan(page)).toEqual(recipient);

		previousDocument = await openUncontrolledPreview();
		page.once('dialog', (dialog) => dialog.accept());
		await page.getByRole('button', { name: 'Copy plan', exact: true }).click();
		await expect(page).toHaveURL(`${origin}/app/plan`);
		await controlledAndReady();
		expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(
			previousDocument
		);
		expect(await readPlan(page)).toEqual({
			...recipient,
			semesters: owner.semesters,
			wishlist: ['02340141']
		});
	});
});
