import { readFileSync, writeFileSync } from 'node:fs';
import {
	expect,
	test,
	type Locator,
	type Page,
	type TestInfo
} from '@playwright/test';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;
type Language = 'en' | 'he';
// Keep the real install/offline lifecycle in full-shell screenshots.
test.use({ serviceWorkers: 'allow' });
test.setTimeout(90_000);
const courses: Record<
	string,
	{ name: string; median?: number; points?: number }
> = JSON.parse(
	readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
);
// Only the anonymous plan is a fixture. All course/catalog responses and route
// components use the checked-in public data and ordinary application bootstrap.
const codes = [
	'02340124',
	'02340141',
	'02340128',
	'02340129',
	'01040033',
	'01040035',
	'01040034',
	'01040013',
	'01040042',
	'01040122',
	'01040166',
	'02340230'
];
const guest = {
	degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
	semesters: [codes.slice(0, 5), codes.slice(5, 9), codes.slice(9)],
	currentSemester: 0,
	exemptions: codes,
	wishlist: codes
};
const sharedSemesters = codes.map((code, index) =>
	codes.slice(index, index + (index % 3) + 1)
);
const previewPath = `/app/preview/${guest.degree.join('/')}?semesters=${sharedSemesters.map((semester) => semester.join('-')).join('~')}`;

async function prepare(page: Page, language: Language) {
	await page.addInitScript(
		({ language, guest }) => {
			if (localStorage.getItem('userData')) return;
			localStorage.setItem('lang', language);
			localStorage.setItem('theme', language === 'he' ? 'dark' : 'light');
			localStorage.setItem('version', '4');
			localStorage.setItem('userData', JSON.stringify(guest));
		},
		{ language, guest }
	);
	// Allow the existing public sign-in image; block optional analytics/auth
	// traffic and never fulfill application data or perform sign-in.
	await page.route('**/*', (route) =>
		new URL(route.request().url()).origin === origin ||
		route.request().url() === 'https://www.svgrepo.com/show/355037/google.svg'
			? route.continue()
			: route.abort()
	);
}

async function settle(page: Page) {
	await expect(page.locator('main')).toBeVisible();
	await expect(page.locator('.course-loading, .preview-loading')).toHaveCount(
		0
	);
	await expect(page.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready',
		{ timeout: 45_000 }
	);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	});
}

async function measure(rail: Locator, headingSelector: string) {
	return rail.evaluate((rail, headingSelector) => {
		const box = (element: Element) => {
			const { left, right, top, bottom, width, height } =
				element.getBoundingClientRect();
			return { left, right, top, bottom, width, height };
		};
		const bounds = box(rail);
		const preview = rail.classList.contains('preview-semesters');
		const items = [
			...rail.querySelectorAll(
				preview ? ':scope > .preview-semester' : ':scope > .course-row-item'
			)
		];
		const style = getComputedStyle(rail);
		const ancestors = [];
		for (
			let ancestor = rail.parentElement;
			ancestor;
			ancestor = ancestor.parentElement
		) {
			const overflow = getComputedStyle(ancestor).overflowX;
			if (overflow !== 'visible')
				ancestors.push({
					...box(ancestor),
					class: ancestor.className,
					overflow
				});
		}
		const header = document.querySelector('header.title-bar')!;
		const sidebar = document.querySelector('.semester-sidebar');
		return {
			url: location.href,
			theme: localStorage.getItem('theme'),
			offlineState: document
				.querySelector('[data-testid="pwa-status"]')
				?.getAttribute('data-state'),
			viewport: { width: innerWidth, height: innerHeight },
			layoutViewportWidth: document.documentElement.clientWidth,
			documentWidth: document.documentElement.scrollWidth,
			documentOverflow:
				document.documentElement.scrollWidth -
				document.documentElement.clientWidth,
			scrollX,
			scrollY,
			rootSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
			header: {
				...box(header),
				direction: header.getAttribute('dir'),
				items: ['.brand', '.header-search', 'nav'].map((selector) =>
					box(header.querySelector(selector)!)
				)
			},
			footer: box(document.querySelector('footer')!),
			settingsContent: [
				...document.querySelectorAll(
					'.settings-page > .account-section, .settings-page > .degree-section, .settings-page > .semester-section'
				)
			].map(box),
			sidebar: sidebar && box(sidebar),
			heading: box(document.querySelector(headingSelector)!),
			rail: {
				...bounds,
				focused: document.activeElement === rail,
				direction: style.direction,
				overflowX: style.overflowX,
				paddingStart: style.paddingInlineStart,
				paddingEnd: style.paddingInlineEnd,
				snap: style.scrollSnapType,
				scrollPadding: style.scrollPaddingInlineStart,
				scrollLeft: rail.scrollLeft,
				maxScroll: rail.scrollWidth - rail.clientWidth
			},
			ancestors,
			semanticLabels: [
				...document.querySelectorAll<HTMLElement>(
					'.settings-page > h1.sr-only, .semester-summary .sr-only, .study-days .exam-round > .sr-only'
				)
			]
				.filter((label) => label.getClientRects().length > 0)
				.map((label) => ({
					...box(label),
					text: label.textContent?.trim(),
					position: getComputedStyle(label).position,
					clip: getComputedStyle(label).clip,
					parent: box(label.parentElement!),
					parentClass: label.parentElement!.className,
					localContainingBlock: label.offsetParent === label.parentElement
				})),
			items: items.map((item) => {
				const card = preview ? item : item.querySelector('.course-card')!;
				const rect = box(card);
				return {
					...rect,
					visibleRatio:
						Math.max(
							0,
							Math.min(bounds.right, rect.right) -
								Math.max(bounds.left, rect.left)
						) / rect.width
				};
			}),
			cards: [...rail.querySelectorAll('.course-card')].map((card) => {
				const name = card.querySelector('.course-name')!;
				const link = card.closest('a, button')!;
				return {
					...box(card),
					naturalHeight: box(card.querySelector('.course-width')!).height,
					control: box(link),
					code: card.querySelector('.course-code')!.textContent!.trim(),
					name: name.textContent!.trim(),
					title: name.getAttribute('title'),
					lineClamp: getComputedStyle(name).webkitLineClamp
				};
			}),
			stacks: preview
				? [...rail.querySelectorAll('.semester-courses')].map((stack) => ({
						direction: getComputedStyle(stack).flexDirection,
						gap: getComputedStyle(stack).gap,
						cards: [...stack.querySelectorAll('.course-card')].map(box)
					}))
				: []
		};
	}, headingSelector);
}

type Geometry = Awaited<ReturnType<typeof measure>>;

function expectShell(
	geometry: Geometry,
	language: Language,
	discovery = false,
	themeLanguage = language
) {
	const { width } = geometry.viewport;
	const rtl = language === 'he';
	expect(geometry.theme).toBe(themeLanguage === 'he' ? 'dark' : 'light');
	expect(geometry.offlineState).toBe('ready');
	expect(
		geometry.documentOverflow,
		'whole document stays in the viewport'
	).toBe(0);
	expect(
		geometry.viewport.width,
		'mobile visual viewport is not expanded by hidden page overflow'
	).toBe(geometry.layoutViewportWidth);
	expect(geometry.scrollX).toBe(0);
	expect(geometry.header.height).toBe(48);
	expect(geometry.header.direction).toBe('ltr');
	for (const item of geometry.header.items) {
		expect(item.left).toBeGreaterThanOrEqual(0);
		expect(item.right).toBeLessThanOrEqual(width);
		expect(
			Math.abs(item.top + item.height / 2 - geometry.header.top - 24)
		).toBeLessThanOrEqual(1);
	}
	expect(geometry.header.items[0].right).toBeLessThanOrEqual(
		geometry.header.items[1].left
	);
	expect(geometry.header.items[1].right).toBeLessThanOrEqual(
		geometry.header.items[2].left
	);
	expect(geometry.footer.left).toBeGreaterThanOrEqual(0);
	expect(geometry.footer.right).toBeLessThanOrEqual(width);
	expect(geometry.rail.direction).toBe(rtl ? 'rtl' : 'ltr');
	expect(geometry.rail.overflowX).toBe('auto');
	for (const section of geometry.settingsContent) {
		const formWidth = Math.min(width - 24, 744);
		expect(section.width, 'original bounded settings form width').toBeCloseTo(
			formWidth,
			1
		);
		expect(section.left, 'original centered settings content').toBeCloseTo(
			(width - formWidth) / 2,
			1
		);
	}
	for (const label of geometry.semanticLabels) {
		expect(label.text, 'accessible label text is retained').toBeTruthy();
		expect(label.position).toBe('absolute');
		expect(label.clip).toBe('rect(0px, 0px, 0px, 0px)');
		expect(
			label.localContainingBlock,
			'hidden label stays anchored to its own semantic container'
		).toBe(true);
		expect(label.left).toBeGreaterThanOrEqual(label.parent.left);
		expect(label.right).toBeLessThanOrEqual(label.parent.right);
		expect(label.top).toBeGreaterThanOrEqual(label.parent.top);
		expect(label.bottom).toBeLessThanOrEqual(label.parent.bottom);
	}
	if (new URL(geometry.url).pathname === '/app/semester') {
		expect(
			geometry.semanticLabels.filter((label) =>
				label.parentClass.split(' ').includes('exam-round')
			).length,
			'visible study-day rows retain locally anchored accessible round labels'
		).toBeGreaterThanOrEqual(2);
	}
	const desktopDiscovery = discovery && width >= 640;
	const expectedLeft = desktopDiscovery && !rtl ? geometry.sidebar!.right : 0;
	const expectedRight =
		desktopDiscovery && rtl ? geometry.sidebar!.left : width;
	expect(
		Math.abs(geometry.rail.left - expectedLeft),
		'rail reaches its available left edge'
	).toBeLessThanOrEqual(1);
	expect(
		Math.abs(geometry.rail.right - expectedRight),
		'rail reaches its available right edge'
	).toBeLessThanOrEqual(1);
	for (const ancestor of geometry.ancestors) {
		expect(
			geometry.rail.left,
			`${ancestor.class}: no outer left clipping gutter`
		).toBeGreaterThanOrEqual(ancestor.left - 1);
		expect(
			geometry.rail.right,
			`${ancestor.class}: no outer right clipping gutter`
		).toBeLessThanOrEqual(ancestor.right + 1);
	}
	const expectedWidth =
		width < 640
			? (width - 2.5 * geometry.rootSize) / 3.25
			: 10.5 * geometry.rootSize;
	for (const card of geometry.cards) {
		expect(
			Math.abs(card.width - expectedWidth),
			'original card width'
		).toBeLessThanOrEqual(1);
		expect(card.name).toBe(courses[card.code].name);
		expect(card.title).toBe(courses[card.code].name);
		expect(card.lineClamp).toBe('3');
	}
	if (!geometry.stacks.length) {
		const tallest = Math.max(
			...geometry.cards.map((card) => card.naturalHeight)
		);
		for (const card of geometry.cards) {
			expect(
				Math.abs(card.height - tallest),
				'equal horizontal card heights'
			).toBeLessThanOrEqual(1);
			expect(
				Math.abs(card.control.height - card.height),
				'full-height native link/button'
			).toBeLessThanOrEqual(1);
		}
	} else {
		// CSSOM omits the default proximity keyword in Chromium/WebKit.
		const [axis, strictness = 'proximity'] = geometry.rail.snap.split(' ');
		expect([axis, strictness]).toEqual(['inline', 'proximity']);
		expect(geometry.rail.scrollPadding).toBe('12px');
		for (const stack of geometry.stacks) {
			expect(stack.direction).toBe('column');
			expect(stack.gap).toBe('6px');
			for (let index = 1; index < stack.cards.length; index++) {
				expect(
					stack.cards[index].top - stack.cards[index - 1].bottom
				).toBeCloseTo(6, 1);
				expect(stack.cards[index].left).toBeCloseTo(stack.cards[0].left, 1);
			}
		}
	}
}

function expectInitial(
	geometry: Geometry,
	language: Language,
	discovery = false
) {
	const first = geometry.items[0];
	const rtl = language === 'he';
	const inset = discovery && geometry.viewport.width >= 640 ? 0 : 12;
	const firstStart = rtl
		? geometry.rail.right - first.right
		: first.left - geometry.rail.left;
	const headingStart = rtl
		? geometry.rail.right - geometry.heading.right
		: geometry.heading.left - geometry.rail.left;
	expect(Math.abs(geometry.rail.scrollLeft)).toBeLessThanOrEqual(1);
	expect(
		Math.abs(firstStart - inset),
		'original logical first-card inset'
	).toBeLessThanOrEqual(1);
	expect(
		Math.abs(firstStart - headingStart),
		'heading and first card align'
	).toBeLessThanOrEqual(1);
	if (geometry.viewport.width < 640) {
		for (const card of geometry.items.slice(0, 3))
			expect(card.visibleRatio).toBeGreaterThanOrEqual(0.99);
		expect(geometry.items[3].visibleRatio).toBeGreaterThanOrEqual(0.1);
		expect(geometry.items[3].visibleRatio).toBeLessThanOrEqual(0.85);
	}
}

async function capture(
	page: Page,
	rail: Locator,
	heading: string,
	info: TestInfo,
	name: string
) {
	await settle(page);
	const geometry = await measure(rail, heading);
	// A viewport screenshot retains the whole app shell without fullPage's RTL
	// scroll-position changes. Numeric evidence includes the complete document.
	const imagePath = info.outputPath(`${name}.png`);
	await page.screenshot({
		path: imagePath,
		fullPage: false,
		animations: 'disabled'
	});
	await info.attach(name, { path: imagePath, contentType: 'image/png' });
	const geometryPath = info.outputPath(`${name}.json`);
	writeFileSync(geometryPath, JSON.stringify(geometry, null, 2));
	await info.attach(`${name}-geometry`, {
		path: geometryPath,
		contentType: 'application/json'
	});
	return geometry;
}

async function verifyRail(
	page: Page,
	rail: Locator,
	heading: string,
	language: Language,
	info: TestInfo,
	name: string,
	discovery = false
) {
	await rail.scrollIntoViewIfNeeded();
	const initial = await capture(page, rail, heading, info, `${name}-initial`);
	expectShell(initial, language, discovery);
	expectInitial(initial, language, discovery);
	const max = initial.rail.maxScroll;
	expect(max, 'fixture overflows even on desktop').toBeGreaterThan(100);
	const sign = language === 'he' ? -1 : 1;
	// Native scrollport measurements; this is not a simulated touch-swipe claim.
	await rail.evaluate(
		(element, left) => element.scrollTo({ left }),
		(sign * max) / 2
	);
	await expect
		.poll(() => rail.evaluate((element) => Math.abs(element.scrollLeft)))
		.toBeGreaterThan(max * 0.25);
	const middle = await capture(page, rail, heading, info, `${name}-middle`);
	expectShell(middle, language, discovery);
	expect(Math.abs(middle.rail.scrollLeft)).toBeLessThan(max * 0.75);
	expect(middle.items[0].visibleRatio).toBeLessThan(0.99);
	await rail.evaluate(
		(element, left) => element.scrollTo({ left }),
		sign * max
	);
	await expect
		.poll(() =>
			rail.evaluate((element) =>
				Math.abs(
					Math.abs(element.scrollLeft) -
						(element.scrollWidth - element.clientWidth)
				)
			)
		)
		.toBeLessThanOrEqual(1);
	const end = await capture(page, rail, heading, info, `${name}-end`);
	expectShell(end, language, discovery);
	expect(
		end.items.at(-1)!.visibleRatio,
		'last card/semester is fully reachable'
	).toBeGreaterThanOrEqual(0.99);
	return end;
}

async function storedPlan(page: Page) {
	return page.evaluate(() => JSON.parse(localStorage.getItem('userData')!));
}

function expectedMedian(codes: string[]) {
	// Original unweighted average: only undefined values are excluded.
	const medians = codes
		.map((code) => courses[code].median)
		.filter((median): median is number => median !== undefined);
	return medians.length
		? Math.round(
				(medians.reduce((sum, median) => sum + median, 0) / medians.length) * 10
			) / 10
		: 0;
}

for (const width of [320, 390, 1180, 1440]) {
	for (const language of ['en', 'he'] as const) {
		test.describe(`${width}px ${language} remaining page rails`, () => {
			test.use({
				viewport: { width, height: 844 },
				isMobile: width < 640,
				hasTouch: width < 640
			});

			test('settings exemptions use the full shell width without moving auth or native controls', async ({
				page
			}, info) => {
				await prepare(page, language);
				await page.goto(`${origin}/app/settings`);
				const root = page.locator('.settings-page');
				const rail = root.locator('.exemptions-section .course-row');
				await expect(rail.locator('.course-card')).toHaveCount(codes.length);
				await expect(root.locator(':scope > h1')).toHaveClass(/\bsr-only\b/);
				await expect(root.locator(':scope > .account-section')).toBeVisible();
				await expect(root.locator('.account-section button')).toBeEnabled();
				const top = await root.evaluate(
					(root) =>
						root.querySelector('.account-section')!.getBoundingClientRect()
							.top - root.getBoundingClientRect().top
				);
				expect(top, 'account remains first with only normal page padding').toBe(
					10
				);
				const degree = root.getByRole('combobox', {
					name: language === 'he' ? 'תואר' : 'Degree',
					exact: true
				});
				await expect(degree).toHaveValue(guest.degree[2]);
				await expect(root.locator('.no-path')).toBeVisible();
				for (const select of await root.locator('select').all()) {
					await expect(select).toBeEnabled();
					await expect(select).toHaveCSS('font-size', '16px');
				}
				const faculty = root.getByRole('combobox', {
					name: language === 'he' ? 'פקולטה' : 'Faculty',
					exact: true
				});
				const alternative = await faculty.locator('option').evaluateAll(
					(options, current) =>
						options
							.filter((option) => !(option as HTMLOptionElement).disabled)
							.map((option) => (option as HTMLOptionElement).value)
							.find((value) => value !== current && value !== ''),
					guest.degree[1]
				);
				expect(alternative).toBeTruthy();
				await faculty.selectOption(alternative!);
				await root
					.locator('.degree-section')
					.getByRole('button', {
						name: language === 'he' ? 'בטל' : 'Cancel',
						exact: true
					})
					.click();
				await expect(faculty).toHaveValue(guest.degree[1]);
				await expect(degree).toHaveValue(guest.degree[2]);
				await verifyRail(
					page,
					rail,
					'.exemptions-section h2',
					language,
					info,
					'settings'
				);
				expect(await storedPlan(page)).toEqual(guest);
				const last = rail.locator('.course-row-item > a').last();
				const href = await last.getAttribute('href');
				await last.click();
				await expect(page).toHaveURL(`${origin}${href}`);
				await page.goBack();
				await expect(page.locator('.exemptions-section')).toBeVisible();
				expect(await storedPlan(page)).toEqual(guest);
			});

			test('shared preview keeps native RTL snapping, vertical stacks, links and import', async ({
				page
			}, info) => {
				await prepare(page, language);
				await page.goto(`${origin}${previewPath}`);
				const rail = page.locator('.preview-semesters');
				await expect(rail.locator('.preview-semester')).toHaveCount(
					sharedSemesters.length
				);
				await expect(page.locator('.preview-heading h1')).not.toBeEmpty();
				await expect(page.locator('.preview-loading')).toHaveCount(0);
				for (const [index, semester] of sharedSemesters.entries()) {
					await expect(
						rail
							.locator('.preview-semester')
							.nth(index)
							.locator('.semester-median')
					).toHaveText(new RegExp(`^\\s*${expectedMedian(semester)}\\s`));
				}
				await verifyRail(
					page,
					rail,
					'.preview-heading h1',
					language,
					info,
					'preview'
				);
				// Change the actual native preference after reaching the end. Browsers
				// may retain or clamp their position; neither behavior is a reset rule.
				const otherLanguage: Language = language === 'he' ? 'en' : 'he';
				const languageSelect = page.locator('footer').getByRole('combobox');
				await languageSelect.selectOption({
					label: otherLanguage === 'he' ? 'עב' : 'en'
				});
				await expect(rail).toHaveCSS(
					'direction',
					otherLanguage === 'he' ? 'rtl' : 'ltr'
				);
				const switched = await capture(
					page,
					rail,
					'.preview-heading h1',
					info,
					'preview-direction-switched'
				);
				expectShell(switched, otherLanguage, false, language);
				await rail.evaluate(
					(element, direction) =>
						element.scrollTo({
							left: direction * (element.scrollWidth - element.clientWidth)
						}),
					otherLanguage === 'he' ? -1 : 1
				);
				await expect
					.poll(() =>
						rail.evaluate((element) =>
							Math.abs(
								Math.abs(element.scrollLeft) -
									(element.scrollWidth - element.clientWidth)
							)
						)
					)
					.toBeLessThanOrEqual(1);
				const switchedEnd = await capture(
					page,
					rail,
					'.preview-heading h1',
					info,
					'preview-switched-end'
				);
				expectShell(switchedEnd, otherLanguage, false, language);
				expect(
					switchedEnd.items.at(-1)!.visibleRatio,
					'terminal semester remains reachable after direction change'
				).toBeGreaterThanOrEqual(0.99);
				await languageSelect.selectOption({
					label: language === 'he' ? 'עב' : 'en'
				});
				await expect(rail).toHaveCSS(
					'direction',
					language === 'he' ? 'rtl' : 'ltr'
				);
				await page.setViewportSize({
					width:
						width === 320
							? 390
							: width === 390
								? 320
								: width === 1180
									? 1440
									: 1180,
					height: 844
				});
				// Explicitly request the new logical start, without requiring resize
				// or language changes to reset the browser's native scroll position.
				await rail.evaluate((element) => element.scrollTo({ left: 0 }));
				await expect
					.poll(() => rail.evaluate((element) => Math.abs(element.scrollLeft)))
					.toBeLessThanOrEqual(1);
				const resized = await capture(
					page,
					rail,
					'.preview-heading h1',
					info,
					'preview-resized-start'
				);
				expectShell(resized, language);
				expectInitial(resized, language);
				const lastLink = rail.locator('.preview-course').last();
				const href = await lastLink.getAttribute('href');
				await lastLink.click();
				await expect(page).toHaveURL(`${origin}${href}`);
				await page.goBack();
				await expect(rail).toBeVisible();
				await settle(page);
				await rail.evaluate((element) => element.scrollTo({ left: 0 }));
				await expect
					.poll(() => rail.evaluate((element) => Math.abs(element.scrollLeft)))
					.toBe(0);
				await rail.focus();
				await expect(rail).toBeFocused();
				const keyboardStart = await capture(
					page,
					rail,
					'.preview-heading h1',
					info,
					'preview-keyboard-start'
				);
				expectShell(keyboardStart, language);
				expectInitial(keyboardStart, language);
				expect(keyboardStart.rail.focused).toBe(true);
				await expect(rail).toBeFocused();
				// Give native key-down scrolling an actual rendering interval after
				// back navigation, rather than coalescing a zero-duration key burst.
				for (let step = 0; step < 8; step++) {
					await page.keyboard.press(
						language === 'he' ? 'ArrowLeft' : 'ArrowRight',
						{ delay: 100 }
					);
				}
				let keyboardEnd: Geometry;
				try {
					await expect
						.poll(() =>
							rail.evaluate((element) => Math.abs(element.scrollLeft))
						)
						.toBeGreaterThan(0);
				} finally {
					keyboardEnd = await capture(
						page,
						rail,
						'.preview-heading h1',
						info,
						'preview-keyboard-end'
					);
				}
				expectShell(keyboardEnd, language);
				expect(keyboardEnd.rail.focused).toBe(true);
				expect(Math.abs(keyboardEnd.rail.scrollLeft)).toBeGreaterThan(0);
				const importButton = page.locator('.preview-actions button');
				page.once('dialog', (dialog) => dialog.dismiss());
				await importButton.click();
				await expect(rail).toBeVisible();
				expect(await storedPlan(page)).toEqual(guest);
				page.once('dialog', (dialog) => dialog.accept());
				await importButton.click();
				await expect(page).toHaveURL(`${origin}/app/plan`);
				await expect
					.poll(() => storedPlan(page))
					.toEqual({
						...guest,
						semesters: sharedSemesters,
						wishlist: guest.wishlist.filter(
							(code) => !sharedSemesters.flat().includes(code)
						)
					});
			});

			test('semester discovery reaches the desktop edge while preserving sidebar, metrics and navigation', async ({
				page
			}, info) => {
				await prepare(page, language);
				await page.goto(`${origin}/app/semester`);
				const rail = page
					.locator('.semester-discovery .course-row:visible')
					.first();
				await expect(rail.locator('.course-card')).toHaveCount(codes.length);
				await verifyRail(
					page,
					rail,
					'.semester-discovery h2',
					language,
					info,
					'semester-discovery',
					true
				);
				if (width >= 640) {
					const sidebar = page.locator('.semester-sidebar');
					await expect(sidebar).toBeVisible();
					await expect(sidebar).toHaveCSS('padding-inline-start', '16px');
					await expect(sidebar).toHaveCSS('padding-inline-end', '16px');
					await expect(
						page.locator('.semester-discovery h2').first()
					).toHaveCSS('padding-inline-end', '16px');
					await expect(sidebar.locator('.semester-median')).toHaveText(
						new RegExp(`^\\s*${expectedMedian(guest.semesters[0])}\\s`)
					);
				} else {
					await expect(
						page.locator('.mobile-semester-summary strong').nth(1)
					).toHaveText(String(expectedMedian(guest.semesters[0])));
					await verifyRail(
						page,
						page.locator('.semester-mobile .course-row'),
						'.semester-mobile h1',
						language,
						info,
						'semester-current'
					);
				}
				expect(await storedPlan(page)).toEqual(guest);
				const last = rail.locator('.course-row-item > button').last();
				const code = await last.locator('.course-code').textContent();
				await last.click();
				await expect(page).toHaveURL(`${origin}/app/course/${code!.trim()}`);
				await page.goBack();
				await expect(page.locator('.semester-page')).toBeVisible();
				if (width >= 640) {
					await page.locator('.semester-sidebar .semester-link').click();
					await expect(page).toHaveURL(`${origin}/app/plan`);
					await page.goBack();
					await expect(page.locator('.semester-page')).toBeVisible();
				}
				expect(await storedPlan(page)).toEqual(guest);
			});
		});
	}
}
