import { createServer, type Server } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

// Identical public courses and fictional guest plan on both source revisions.
// No account sign-in, provider responses, private plans or auth mocks are used.
const guest = {
	degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
	path: 'CG00006246',
	exemptions: [],
	currentSemester: 0,
	wishlist: ['02340124', '02340141', '02340128', '02340129'],
	semesters: [
		['02340114', '02340117', '02340118'],
		['02340123', '02340125', '02340218'],
		['02340221', '02340230', '02340247'],
		['02340290', '02340291', '02340292'],
		['02340303', '02340311', '02340313']
	]
};
const baseline = process.env.DENSITY_VARIANT === 'before';
let server: Server;
let origin: string;
let workerRevision = 0;

// Serve the actual production app. Only a comment in its worker script changes
// when a test explicitly requests an update, matching the existing PWA suite.
test.beforeAll(async () => {
	const worker = await readFile(
		'.svelte-kit/output/client/service-worker.js',
		'utf8'
	);
	server = createServer(async (request, response) => {
		try {
			if (request.url === '/service-worker.js') {
				response.writeHead(200, {
					'content-type': 'application/javascript',
					'cache-control': 'no-store'
				});
				response.end(
					`${worker}\n// Density update fixture ${workerRevision}\n`
				);
				return;
			}
			const upstream = await fetch(`http://127.0.0.1:4183${request.url}`);
			response.writeHead(upstream.status, {
				'content-type':
					upstream.headers.get('content-type') ?? 'application/octet-stream'
			});
			response.end(Buffer.from(await upstream.arrayBuffer()));
		} catch {
			response.writeHead(502);
			response.end();
		}
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string')
		throw new Error('Missing proxy address');
	origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
	server?.closeAllConnections();
	await new Promise<void>((resolve) => server?.close(() => resolve()));
});

async function settled(page: Page) {
	await expect(page.locator('#console-boot')).toBeHidden();
	await expect(page.locator('main')).toBeVisible();
	await expect(page.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready',
		{ timeout: 45_000 }
	);
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await page.evaluate(() => document.fonts.ready);
}

async function measure(page: Page, route: string) {
	return page.evaluate((route) => {
		const rect = (selector: string) =>
			document.querySelector(selector)?.getBoundingClientRect();
		const round = (value: number) => Math.round(value * 10) / 10;
		const header = rect('header.title-bar')!;
		const main = rect('main')!;
		const target: Record<string, string> = {
			plan: '[data-semester="0"] .course-card',
			search: 'main ul > li .course-card',
			settings: '.settings-field select',
			course: '[data-testid="course-plan-actions"] button',
			update: '.semester-field select'
		};
		const task = rect(target[route]);
		const visibleRatio = (element: Element) => {
			const box = element.getBoundingClientRect();
			let left = Math.max(0, box.left);
			let right = Math.min(innerWidth, box.right);
			let top = Math.max(0, box.top);
			let bottom = Math.min(innerHeight, box.bottom);
			for (
				let parent = element.parentElement;
				parent;
				parent = parent.parentElement
			) {
				const css = getComputedStyle(parent);
				const clip = parent.getBoundingClientRect();
				if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) {
					left = Math.max(left, clip.left);
					right = Math.min(right, clip.right);
				}
				if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) {
					top = Math.max(top, clip.top);
					bottom = Math.min(bottom, clip.bottom);
				}
			}
			return box.width && box.height
				? (Math.max(0, right - left) * Math.max(0, bottom - top)) /
						(box.width * box.height)
				: 0;
		};
		const cards = [...document.querySelectorAll('main .course-card')];
		const ratios = cards.map(visibleRatio);
		const firstSemesterCards = [...document.querySelectorAll('[data-semester]')]
			.slice(0, 3)
			.map((semester) => semester.querySelector('.course-card'));
		const firstWishlistCards = [
			...document.querySelectorAll('[data-testid="plan-wishlist"] .course-card')
		].slice(0, 3);
		const unclippedCourseNames = [
			...document.querySelectorAll('main .course-name')
		].filter((name) => {
			const copy = name.closest('.course-copy')?.getBoundingClientRect();
			if (!copy || !name.textContent?.trim()) return false;
			if (name.getAttribute('title') !== name.textContent.trim()) return false;
			const range = document.createRange();
			range.selectNodeContents(name);
			return [...range.getClientRects()].every(
				(box) =>
					box.left >= copy.left - 1 &&
					box.right <= copy.right + 1 &&
					box.top >= copy.top - 1 &&
					box.bottom <= copy.bottom + 1
			);
		}).length;
		const horizontalRatios = (selector: string) =>
			[...document.querySelectorAll(selector)].map((element) => {
				const box = element.getBoundingClientRect();
				return (
					Math.round(
						(1000 *
							Math.max(
								0,
								Math.min(innerWidth, box.right) - Math.max(0, box.left)
							)) /
							box.width
					) / 1000
				);
			});
		return {
			route,
			viewport: { width: innerWidth, height: innerHeight },
			scrollY: round(scrollY),
			headerHeight: round(header.height),
			statusLayoutHeight: round(Math.max(0, main.top - header.bottom - 1)),
			mainTop: round(main.top),
			usableViewportHeight: round(Math.max(0, innerHeight - main.top)),
			taskContentTop: task ? round(task.top) : null,
			taskViewportHeight: task ? round(Math.max(0, innerHeight - task.top)) : 0,
			fullyVisibleCourseCards: ratios.filter((value) => value >= 0.98).length,
			partlyVisibleCourseCards: ratios.filter(
				(value) => value > 0.05 && value < 0.98
			).length,
			firstSemesterCourseRatios: firstSemesterCards.map((card) =>
				card ? visibleRatio(card) : 0
			),
			firstWishlistCourseRatios: firstWishlistCards.map(visibleRatio),
			unclippedCourseNames,
			semesterColumnRatios: horizontalRatios('[data-semester]'),
			wishlistCardRatios: horizontalRatios(
				'[data-testid="plan-wishlist"] > [data-code]'
			),
			railScroll: [...document.querySelectorAll('[data-plan-scroll]')].map(
				(rail) => ({
					id: rail.getAttribute('data-testid'),
					scrollLeft: round(rail.scrollLeft),
					clientWidth: rail.clientWidth,
					scrollWidth: rail.scrollWidth,
					direction: getComputedStyle(rail).direction
				})
			),
			horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
		};
	}, route);
}

type Measurement = Awaited<ReturnType<typeof measure>>;
async function capture(page: Page, info: TestInfo, name: string, route = name) {
	await settled(page);
	await page.evaluate(() => scrollTo(0, 0));
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	const measurement = await measure(page, route);
	const path = info.outputPath(`${name}.png`);
	await page.screenshot({ path, animations: 'disabled' });
	await info.attach(name, { path, contentType: 'image/png' });
	expect
		.soft(
			measurement.horizontalOverflow,
			`${name}: document must not scroll sideways`
		)
		.toBe(false);
	if (!baseline) {
		expect
			.soft(measurement.headerHeight, `${name}: compact full-shell header`)
			.toBeLessThanOrEqual(88);
		expect
			.soft(
				measurement.statusLayoutHeight,
				`${name}: no routine status banner above work`
			)
			.toBeLessThanOrEqual(2);
	}
	return { ...measurement, route: name };
}

for (const viewport of [
	{ width: 320, height: 568 },
	{ width: 390, height: 664 }
]) {
	test.describe(`${viewport.width}x${viewport.height}`, () => {
		test.use({ viewport });
		for (const language of ['en', 'he'] as const) {
			test(`${language}: full-shell density and real guest tasks`, async ({
				page,
				context
			}, info) => {
				const measurements: Measurement[] = [];
				const checkpoints: string[] = [];
				let blockedExternalRequests = 0;
				await context.route('**/*', async (route) => {
					if (new URL(route.request().url()).origin !== origin) {
						blockedExternalRequests++;
						await route.abort();
					} else await route.continue();
				});
				await page.addInitScript(
					({ language, guest }) => {
						if (localStorage.getItem('userData')) return;
						localStorage.setItem('lang', language);
						localStorage.setItem('theme', 'light');
						localStorage.setItem('version', '4');
						localStorage.setItem('userData', JSON.stringify(guest));
					},
					{ language, guest }
				);
				try {
					await page.goto(`${origin}/app/plan`);
					await settled(page);
					await expect(page.locator('.course-card')).toHaveCount(19);
					await expect(page.locator('main').locator('..')).toHaveAttribute(
						'dir',
						language === 'he' ? 'rtl' : 'ltr'
					);
					const navigationOrigin = await page.evaluate(
						() => performance.timeOrigin
					);
					const plan = await capture(page, info, 'plan');
					measurements.push(plan);
					if (!baseline) {
						for (const [label, ratios] of [
							['semester columns', plan.semesterColumnRatios],
							['wishlist cards', plan.wishlistCardRatios]
						] as const) {
							expect
								.soft(ratios.slice(0, 3), `${label}: three complete cards`)
								.toEqual([1, 1, 1]);
							expect
								.soft(
									ratios[3],
									`${label}: fourth card must invite horizontal scrolling`
								)
								.toBeGreaterThanOrEqual(0.1);
							expect
								.soft(ratios[3], `${label}: fourth card must be clipped`)
								.toBeLessThanOrEqual(0.85);
						}
						expect.soft(plan.semesterColumnRatios[4]).toBe(0);
						// Full SAP names and the original full-width warning footer have
						// variable height. Protect useful initial rows without requiring
						// truncation to reach the previous corner-warning layout's count.
						for (const [label, ratios] of [
							['first semester courses', plan.firstSemesterCourseRatios],
							['first wishlist courses', plan.firstWishlistCourseRatios]
						] as const) {
							expect
								.soft(ratios, `${label}: three complete cards`)
								.toHaveLength(3);
							for (const ratio of ratios)
								expect
									.soft(ratio, `${label}: full card in viewport`)
									.toBeGreaterThanOrEqual(0.98);
						}
						expect
							.soft(
								plan.unclippedCourseNames,
								'full course names remain unclipped'
							)
							.toBe(19);
					}
					checkpoints.push('initial-direction-plan-geometry-captured');

					const search = page.locator('header.title-bar input[type="text"]');
					// Six-digit numbers are legacy exact codes; use a five-digit prefix.
					await search.fill('02340');
					await search.press('Enter');
					await expect(page).toHaveURL(`${origin}/app/search?q=02340`);
					await expect(page.locator('main ul > li')).not.toHaveCount(0);
					await expect(
						page.locator('details.search-filters')
					).not.toHaveAttribute('open', '');
					measurements.push(await capture(page, info, 'search'));
					await page.locator('details.search-filters summary').click();
					await page.locator('fieldset input[type="checkbox"]').check();
					await expect
						.poll(() => new URL(page.url()).searchParams.has('available'))
						.toBe(true);
					await page.locator('fieldset button').click();
					await expect
						.poll(() => new URL(page.url()).searchParams.has('available'))
						.toBe(false);
					await page.goBack();
					await expect(
						page.locator('fieldset input[type="checkbox"]')
					).toBeChecked();
					await page.goForward();
					await expect(
						page.locator('fieldset input[type="checkbox"]')
					).not.toBeChecked();
					await page.locator('details.search-filters summary').click();
					checkpoints.push('real-search-submit-filter-clear-and-history');

					await page.locator('main li[id="02340141"] button').click();
					await expect(page).toHaveURL(`${origin}/app/course/02340141`);
					await expect(page.locator('main h1')).toContainText('קומבינטוריקה');
					measurements.push(await capture(page, info, 'course'));
					const planAction = page.getByRole('button', {
						name: language === 'he' ? 'הוספה' : 'Plan',
						exact: true
					});
					await expect(planAction).toBeEnabled();
					const beforeOffline = await page.evaluate(() =>
						localStorage.getItem('userData')
					);
					await context.setOffline(true);
					await expect(planAction).toBeDisabled();
					measurements.push(
						await capture(page, info, 'course-offline', 'course')
					);
					expect(
						await page.evaluate(() => localStorage.getItem('userData'))
					).toBe(beforeOffline);
					await context.setOffline(false);
					await expect(planAction).toBeEnabled();
					await planAction.click();
					await expect
						.poll(() =>
							page.evaluate(() =>
								JSON.parse(
									localStorage.getItem('userData')!
								).semesters[0].includes('02340141')
							)
						)
						.toBe(true);
					checkpoints.push(
						'offline-action-guard-and-reconnect-local-guest-write'
					);

					await page
						.locator('header.title-bar a[href="/app/settings"]')
						.click();
					await expect(page).toHaveURL(`${origin}/app/settings`);
					await expect(page.locator('.semester-field select')).toHaveCount(2);
					measurements.push(await capture(page, info, 'settings'));
					const current = page.locator('.semester-field').first();
					const choice = current.locator('select');
					const save = current.getByRole('button', {
						name: language === 'he' ? 'שמור' : 'Save',
						exact: true
					});
					const cancel = current.getByRole('button', {
						name: language === 'he' ? 'בטל' : 'Cancel',
						exact: true
					});
					await choice.selectOption('1');
					await cancel.click();
					await expect(choice).toHaveValue('0');
					await choice.selectOption('1');
					await context.setOffline(true);
					await expect(save).toBeDisabled();
					await expect(choice).toHaveValue('1');
					await context.setOffline(false);
					await expect(save).toBeEnabled();
					await expect(choice).toHaveValue('1');
					checkpoints.push('settings-cancel-and-offline-draft-preservation');

					workerRevision++;
					await page.evaluate(async () =>
						(await navigator.serviceWorker.getRegistration())!.update()
					);
					await expect
						.poll(() =>
							page.evaluate(
								async () =>
									(await navigator.serviceWorker.getRegistration())?.waiting
										?.state
							)
						)
						.toBe('installed');
					// The UI may use an optional disclosure, but an update must not reload
					// or consume the task viewport while the unsaved draft is mounted.
					await expect(page.getByTestId('pwa-update')).toBeAttached();
					measurements.push(
						await capture(page, info, 'settings-update', 'update')
					);
					await expect(choice).toHaveValue('1');
					if (!baseline) {
						const details = page.locator('details.pwa-details');
						await expect(details).not.toHaveAttribute('open', '');
						await details.locator('summary').click();
						await expect(page.getByTestId('pwa-update')).toBeVisible();
						const expanded = await measure(page, 'update');
						expect.soft(expanded.mainTop).toBe(measurements.at(-1)!.mainTop);
						expect.soft(expanded.horizontalOverflow).toBe(false);
						const path = info.outputPath('settings-update-details.png');
						await page.screenshot({ path, animations: 'disabled' });
						await info.attach('settings-update-details', {
							path,
							contentType: 'image/png'
						});
						await details
							.getByRole('button', {
								name: language === 'he' ? 'סגירה' : 'Close',
								exact: true
							})
							.click();
						await expect(choice).toHaveValue('1');
						checkpoints.push(
							'update-disclosure-opens-and-dismisses-without-layout-shift'
						);
					}
					expect(await page.evaluate(() => performance.timeOrigin)).toBe(
						navigationOrigin
					);
					await save.click();
					await expect
						.poll(() =>
							page.evaluate(
								() =>
									JSON.parse(localStorage.getItem('userData')!).currentSemester
							)
						)
						.toBe(1);
					await page.reload();
					await expect(
						page.locator('.semester-field select').first()
					).toHaveValue('1');
					checkpoints.push(
						'real-worker-update-keeps-draft-and-save-survives-reload'
					);
				} finally {
					const path = info.outputPath('density.json');
					await writeFile(
						path,
						`${JSON.stringify(
							{
								schemaVersion: 1,
								variant: process.env.DENSITY_VARIANT ?? 'current',
								sourceRevision: process.env.DENSITY_SOURCE_REVISION ?? null,
								language,
								viewport,
								status: info.status,
								checkpoints,
								measurements,
								blockedExternalRequests,
								limitations: [
									'Chromium mobile emulation; not a physical device or installed-app check.',
									'Fresh anonymous contexts with a fictional local guest plan and unchanged public catalog data.',
									'Local production-build proxy; worker update changes a comment only.',
									'No private data, browser storage, request bodies, headers or authentication exports.'
								]
							},
							null,
							2
						)}\n`
					);
					await info.attach('density.json', {
						path,
						contentType: 'application/json'
					});
				}
			});
		}
	});
}
