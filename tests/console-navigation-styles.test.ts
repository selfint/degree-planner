import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;
const targets = ['catalog', 'plan', 'settings'] as const;
type Target = (typeof targets)[number];
type Language = 'en' | 'he';
type Theme = 'light' | 'dark';
const courseCode = '02340124';
const plannedCourseCode = '01040031';
// Read expectations from the real checked-in snapshot, without replacing responses.
const courses = JSON.parse(
	readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
) as Record<string, { name: string }>;
const guest = {
	degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
	semesters: [[plannedCourseCode], [], []],
	currentSemester: 0,
	exemptions: [],
	wishlist: [courseCode]
};
const colors = {
	light: {
		accent: 'rgb(15, 111, 103)',
		activeBackground: 'rgba(15, 111, 103, 0.12)',
		secondary: 'rgb(67, 82, 97)',
		primary: 'rgb(23, 37, 51)',
		card: 'rgb(255, 255, 255)'
	},
	dark: {
		accent: 'rgb(76, 169, 161)',
		activeBackground: 'rgba(76, 169, 161, 0.12)',
		secondary: 'rgb(173, 181, 185)',
		primary: 'rgb(255, 255, 255)',
		card: 'rgb(36, 36, 42)'
	}
};
// Viewport captures can include the footer: preserve the real SW lifecycle rather
// than Playwright's blocked-registration error or a replacement navigator API.
test.use({ serviceWorkers: 'allow' });
test.setTimeout(120_000);

function navLink(page: Page, target: Target) {
	return page.locator(`header.title-bar nav a[href="/app/${target}"]`);
}

async function prepareGuest(page: Page, language: Language, theme: Theme) {
	await page.addInitScript(
		({ guest, language, theme }) => {
			if (localStorage.getItem('userData')) return;
			localStorage.setItem('version', '4');
			localStorage.setItem('userData', JSON.stringify(guest));
			localStorage.setItem('lang', language);
			localStorage.setItem('theme', theme);
		},
		{ guest, language, theme }
	);
	// No private account is used. Same-origin public data and app/SW requests run
	// normally; external authentication and analytics requests are not needed.
	await page.route('**/*', (route) =>
		new URL(route.request().url()).origin === origin
			? route.continue()
			: route.abort()
	);
}

async function settle(page: Page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	});
}

async function expectRoute(page: Page, target: Target, language: Language) {
	await expect(page).toHaveURL(`${origin}/app/${target}`);
	await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('#console-boot')).toHaveCount(0);
	await expect(page.getByTestId('console-entry-loading')).toHaveCount(0);
	await expect(page.locator('.console-shell')).toHaveAttribute(
		'dir',
		language === 'he' ? 'rtl' : 'ltr'
	);
	if (target === 'settings') {
		await expect(
			page.locator('main').getByRole('combobox', {
				name: language === 'he' ? 'תואר' : 'Degree',
				exact: true
			})
		).toHaveValue(guest.degree[2], { timeout: 30_000 });
	} else {
		const course =
			target === 'plan'
				? page
						.getByTestId('plan-wishlist')
						.locator(`[data-code="${courseCode}"]`)
				: page
						.locator(`.catalog-page a[href="/app/course/${courseCode}"]`)
						.first();
		await expect(course.locator('.course-name')).toHaveText(
			courses[courseCode].name,
			{ timeout: 30_000 }
		);
		if (target === 'plan')
			await expect(
				page.locator(
					`[data-semester="0"] [data-code="${plannedCourseCode}"] .course-name`
				)
			).toHaveText(courses[plannedCourseCode].name, { timeout: 30_000 });
	}
	await expect(page.locator('.catalog-loading, .course-loading')).toHaveCount(
		0
	);
	await settle(page);
}

async function measureNavigation(page: Page) {
	return page.locator('header.title-bar').evaluate((header) => {
		const box = (element: Element) => {
			const { left, right, top, bottom, width, height } =
				element.getBoundingClientRect();
			return { left, right, top, bottom, width, height };
		};
		const typography = (element: Element, pseudo?: string) => {
			const style = getComputedStyle(element, pseudo);
			return {
				fontSize: style.fontSize,
				lineHeight: style.lineHeight,
				fontFamily: style.fontFamily
			};
		};
		const input = header.querySelector<HTMLInputElement>(
			'.header-search input'
		)!;
		const icon = header.querySelector('.search-icon')!;
		const logo = header.querySelector('.brand-logo')!;
		return {
			url: location.href,
			viewport: { width: innerWidth, height: innerHeight },
			theme: document.documentElement.dataset.theme,
			compactHeader: matchMedia('(max-width: 39.99rem)').matches,
			fineHover: matchMedia('(hover: hover) and (pointer: fine)').matches,
			documentOverflow: document.documentElement.scrollWidth - innerWidth,
			scrollX,
			header: {
				...box(header),
				direction: header.getAttribute('dir'),
				logo: box(logo),
				search: {
					input: { ...box(input), ...typography(input) },
					placeholder: typography(input, '::placeholder'),
					icon: {
						wrapper: box(icon),
						svg: box(icon.querySelector('svg')!),
						glyph: box(icon.querySelector('svg path')!)
					}
				},
				items: ['.brand', '.header-search', 'nav'].map((selector) =>
					box(header.querySelector(selector)!)
				)
			},
			links: [...header.querySelectorAll<HTMLAnchorElement>('nav a')].map(
				(link) => {
					const style = getComputedStyle(link);
					const icon = link.querySelector('svg path');
					return {
						...typography(link),
						href: link.getAttribute('href'),
						current: link.getAttribute('aria-current'),
						active: link.classList.contains('active'),
						color: style.color,
						background: style.backgroundColor,
						iconFill: icon ? getComputedStyle(icon).fill : null,
						hover: link.matches(':hover'),
						focused: link === document.activeElement,
						focusVisible: link.matches(':focus-visible'),
						outline: {
							style: style.outlineStyle,
							width: parseFloat(style.outlineWidth),
							offset: parseFloat(style.outlineOffset),
							color: style.outlineColor
						},
						bounds: box(link),
						whiteSpace: style.whiteSpace,
						overflow: link.scrollWidth - link.clientWidth
					};
				}
			)
		};
	});
}

async function measurePlanToolbar(page: Page) {
	return page.locator('.plan-toolbar').evaluate((toolbar) => {
		const box = (element: Element) => {
			const { left, right, top, bottom, width, height } =
				element.getBoundingClientRect();
			return { left, right, top, bottom, width, height };
		};
		const text = (element: Element) => {
			const bounds = box(element);
			const parent = box(element.parentElement!);
			const style = getComputedStyle(element);
			const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
			const rects: DOMRect[] = [];
			while (walker.nextNode()) {
				if (!walker.currentNode.textContent?.trim()) continue;
				const range = document.createRange();
				range.selectNodeContents(walker.currentNode);
				rects.push(
					...[...range.getClientRects()].filter((rect) => rect.width > 0)
				);
			}
			return {
				bounds,
				label: element.textContent?.trim(),
				fontSize: style.fontSize,
				whiteSpace: style.whiteSpace,
				color: style.color,
				background: style.backgroundColor,
				paddingStart: style.paddingInlineStart,
				paddingEnd: style.paddingInlineEnd,
				overflow: element.scrollWidth - element.clientWidth,
				lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
				textFits: rects.every(
					(rect) =>
						rect.left >= Math.max(bounds.left, parent.left) - 0.5 &&
						rect.right <= Math.min(bounds.right, parent.right) + 0.5 &&
						rect.top >= bounds.top - 0.5 &&
						rect.bottom <= bounds.bottom + 0.5
				)
			};
		};
		const share = toolbar.querySelector<HTMLAnchorElement>('.plan-share')!;
		return {
			bounds: box(toolbar),
			direction: getComputedStyle(toolbar).direction,
			heading: text(toolbar.querySelector('.wishlist-heading')!),
			share: {
				...text(share),
				href: share.getAttribute('href'),
				target: share.target,
				rel: share.rel
			},
			actions: [...toolbar.querySelectorAll('.ui-button')].map(text),
			overflow: toolbar.scrollWidth - toolbar.clientWidth
		};
	});
}

function expectPlanToolbar(
	toolbar: Awaited<ReturnType<typeof measurePlanToolbar>>,
	language: Language,
	viewportWidth: number
) {
	const { heading, share, bounds } = toolbar;
	expect(heading.label).toBe(language === 'he' ? 'רשימת משאלות' : 'Wish list');
	expect(share.label).toBe(language === 'he' ? 'שתף' : 'Share');
	expect(share.paddingStart).toBe('8px');
	expect(share.paddingEnd).toBe('8px');
	expect(
		share.bounds.width,
		'the shorter Share label retains a usable target'
	).toBeGreaterThanOrEqual(36);
	expect(share.color, 'Share keeps white text in both themes').toBe(
		'rgb(255, 255, 255)'
	);
	expect(share.background).toBe('rgb(15, 111, 103)');
	const luminance = (color: string) => {
		const channels = color
			.match(/[\d.]+/g)!
			.slice(0, 3)
			.map((value) => {
				const channel = Number(value) / 255;
				return channel <= 0.04045
					? channel / 12.92
					: ((channel + 0.055) / 1.055) ** 2.4;
			});
		return channels.reduce(
			(sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
			0
		);
	};
	const foreground = luminance(share.color);
	const background = luminance(share.background);
	expect(
		(Math.max(foreground, background) + 0.05) /
			(Math.min(foreground, background) + 0.05),
		'Share text contrast meets WCAG AA for normal-sized text'
	).toBeGreaterThanOrEqual(4.5);
	expect(share.href).toBe(
		`/app/preview/${guest.degree.join('/')}?semesters=${plannedCourseCode}%7E%7E`
	);
	expect(share.target).toBe('_blank');
	expect(share.rel.split(' ')).toEqual(
		expect.arrayContaining(['noopener', 'noreferrer'])
	);
	expect(bounds.left).toBeGreaterThanOrEqual(0);
	expect(bounds.right).toBeLessThanOrEqual(viewportWidth);
	expect(bounds.height, 'preserve the one-row plan toolbar').toBeCloseTo(36, 1);
	expect(toolbar.overflow).toBeLessThanOrEqual(1);
	for (const item of [heading, ...toolbar.actions]) {
		expect(item.fontSize, item.label).toBe('14px');
		expect(item.whiteSpace, item.label).toBe('nowrap');
		expect(item.lines, `${item.label} has one actual rendered text line`).toBe(
			1
		);
		expect(item.textFits, `${item.label} text fits its box and parent`).toBe(
			true
		);
		expect(item.overflow, item.label).toBeLessThanOrEqual(1);
		expect(item.bounds.left, item.label).toBeGreaterThanOrEqual(
			bounds.left - 0.5
		);
		expect(item.bounds.right, item.label).toBeLessThanOrEqual(
			bounds.right + 0.5
		);
		expect(item.bounds.top + item.bounds.height / 2, item.label).toBeCloseTo(
			bounds.top + bounds.height / 2,
			1
		);
	}
	const actionStart = Math.min(
		...toolbar.actions.map((item) => item.bounds.left)
	);
	const actionEnd = Math.max(
		...toolbar.actions.map((item) => item.bounds.right)
	);
	expect(
		toolbar.direction === 'rtl'
			? heading.bounds.left - actionEnd
			: actionStart - heading.bounds.right,
		'the unwrapped wish-list heading never overlaps the action group'
	).toBeGreaterThanOrEqual(11.5);
	for (const action of toolbar.actions)
		expect(
			action.bounds.height,
			`${action.label} retains its usable height`
		).toBeCloseTo(36, 1);
}

type Navigation = Awaited<ReturnType<typeof measureNavigation>>;
type Evidence = {
	name: string;
	expectedActive: Target | null;
	state: Navigation;
	toolbar?: Awaited<ReturnType<typeof measurePlanToolbar>>;
};

function expectNavigation(
	state: Navigation,
	active: Target | null,
	theme: Theme
) {
	const palette = colors[theme];
	const { logo, search } = state.header;
	const inputCenter = search.input.top + search.input.height / 2;

	expect(state.theme).toBe(theme);
	expect(logo.width, 'slightly enlarged original logo').toBe(
		state.compactHeader ? 28 : 32
	);
	expect(logo.height, 'preserve the square original logo').toBe(logo.width);
	expect(search.input.fontSize, 'use compact, consistent titlebar text').toBe(
		'14px'
	);
	expect(search.input.lineHeight).toBe('21px');
	expect(search.placeholder.fontSize).toBe(search.input.fontSize);
	expect(
		search.input.width,
		'retain usable narrow-screen search space'
	).toBeGreaterThanOrEqual(80);
	expect(inputCenter).toBeCloseTo(
		state.header.top + state.header.height / 2,
		1
	);
	for (const [name, bounds] of Object.entries(search.icon)) {
		expect(bounds.width, `${name} magnifier width`).toBeCloseTo(
			state.compactHeader ? 14 : 16,
			1
		);
		expect(bounds.height, `${name} magnifier is square`).toBeCloseTo(
			bounds.width,
			1
		);
		expect(
			Math.abs(bounds.top + bounds.height / 2 - inputCenter),
			`${name} magnifier vertically centered with the input`
		).toBeLessThanOrEqual(0.5);
		expect(bounds.top).toBeGreaterThanOrEqual(search.input.top);
		expect(bounds.bottom).toBeLessThanOrEqual(search.input.bottom);
	}
	expect(state.links.map(({ href }) => href)).toEqual(
		targets.map((target) => `/app/${target}`)
	);
	expect(state.links.filter((link) => link.current !== null)).toHaveLength(
		active ? 1 : 0
	);
	expect(state.links.filter((link) => link.active)).toHaveLength(
		active ? 1 : 0
	);
	for (const link of state.links) {
		expect(link.fontSize, `${link.href} matches Search text size`).toBe(
			search.input.fontSize
		);
		expect(link.lineHeight, `${link.href} matches Search line height`).toBe(
			search.input.lineHeight
		);
		expect(link.fontFamily, `${link.href} matches Search font`).toBe(
			search.input.fontFamily
		);
		expect(link.whiteSpace, `${link.href} stays on one line`).toBe('nowrap');
		const isActive = link.href === `/app/${active}`;
		const hover = state.fineHover && link.hover && !isActive;
		const foreground = isActive
			? palette.accent
			: hover
				? palette.primary
				: palette.secondary;
		expect(link.current, link.href!).toBe(isActive ? 'page' : null);
		expect(link.active, link.href!).toBe(isActive);
		expect(link.color, `${link.href} foreground`).toBe(foreground);
		expect(link.background, `${link.href} background`).toBe(
			isActive
				? palette.activeBackground
				: hover
					? palette.card
					: 'rgba(0, 0, 0, 0)'
		);
		if (link.iconFill !== null)
			expect(link.iconFill, 'settings icon inherits its tab color').toBe(
				foreground
			);
		expect(link.overflow, link.href!).toBeLessThanOrEqual(1);
		expect(link.bounds.left).toBeGreaterThanOrEqual(0);
		expect(link.bounds.right).toBeLessThanOrEqual(state.viewport.width);
	}
	expect(
		state.documentOverflow,
		'no horizontal document overflow'
	).toBeLessThanOrEqual(1);
	expect(Math.abs(state.scrollX)).toBeLessThanOrEqual(1);
	expect(state.header.height, 'retain the original single-row header').toBe(48);
	expect(state.header.direction).toBe('ltr');
	for (const item of state.header.items) {
		expect(item.left).toBeGreaterThanOrEqual(0);
		expect(item.right).toBeLessThanOrEqual(state.viewport.width);
		expect(item.top + item.height / 2).toBeCloseTo(state.header.top + 24, 1);
	}
	expect(state.header.items[0].right).toBeLessThanOrEqual(
		state.header.items[1].left
	);
	expect(state.header.items[1].right).toBeLessThanOrEqual(
		state.header.items[2].left
	);
}

function expectKeyboardFocus(state: Navigation, target: Target, theme: Theme) {
	const link = state.links.find(({ href }) => href === `/app/${target}`)!;
	expect(link.focused, 'native keyboard focus').toBe(true);
	expect(link.focusVisible, 'visible keyboard focus').toBe(true);
	expect(link.outline.style).toBe('solid');
	expect(link.outline.width).toBeGreaterThanOrEqual(2);
	expect(link.outline.offset).toBeGreaterThanOrEqual(0);
	expect(link.outline.color).toBe(colors[theme].accent);
	const extent = link.outline.width + link.outline.offset;
	expect(link.bounds.left - extent).toBeGreaterThanOrEqual(0);
	expect(link.bounds.right + extent).toBeLessThanOrEqual(state.viewport.width);
	expect(link.bounds.top - extent).toBeGreaterThanOrEqual(0);
	expect(link.bounds.bottom + extent).toBeLessThanOrEqual(
		state.viewport.height
	);
}

async function focusFromKeyboard(page: Page, target: Target) {
	// Start before the nav, then use real Tab events through all preceding tabs.
	await page.locator('header.title-bar input').focus();
	for (let index = 0; index <= targets.indexOf(target); index++)
		await page.keyboard.press('Tab');
	await expect(navLink(page, target)).toBeFocused();
}

async function capture(page: Page, info: TestInfo, name: string) {
	const path = info.outputPath(`${name}.png`);
	await page.screenshot({ path, fullPage: false, animations: 'disabled' });
	await info.attach(name, { path, contentType: 'image/png' });
}

async function saveEvidence(info: TestInfo, records: Evidence[]) {
	const path = info.outputPath('navigation-states.json');
	writeFileSync(path, JSON.stringify(records, null, 2));
	await info.attach('navigation-states', {
		path,
		contentType: 'application/json'
	});
}

function recorder(
	page: Page,
	info: TestInfo,
	theme: Theme,
	language: Language,
	records: Evidence[]
) {
	return async (name: string, active: Target | null, screenshot = false) => {
		await settle(page);
		const state = await measureNavigation(page);
		const toolbar =
			active === 'plan' ? await measurePlanToolbar(page) : undefined;
		records.push({ name, expectedActive: active, state, toolbar });
		// Capture before assertions so an unexpected sticky/hover color is visible.
		if (screenshot) await capture(page, info, name);
		expectNavigation(state, active, theme);
		if (toolbar) expectPlanToolbar(toolbar, language, state.viewport.width);
		return state;
	};
}

async function expectPlanDraftAndCancel(
	page: Page,
	checkpoint: ReturnType<typeof recorder>,
	language: Language
) {
	const toolbar = page.locator('.plan-toolbar');
	const share = toolbar.getByRole('link', {
		name: language === 'he' ? 'שתף' : 'Share',
		exact: true
	});
	await focusFromKeyboard(page, 'settings');
	await page.keyboard.press('Tab');
	await expect(share).toBeFocused();
	const ring = await share.evaluate((element) => {
		const style = getComputedStyle(element);
		const bounds = element.getBoundingClientRect();
		const extent =
			parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
		return {
			visible: element.matches(':focus-visible'),
			style: style.outlineStyle,
			width: parseFloat(style.outlineWidth),
			left: bounds.left - extent,
			right: bounds.right + extent,
			top: bounds.top - extent,
			bottom: bounds.bottom + extent
		};
	});
	expect(ring.visible).toBe(true);
	expect(ring.style).toBe('solid');
	expect(ring.width).toBeGreaterThanOrEqual(2);
	expect(ring.left).toBeGreaterThanOrEqual(0);
	expect(ring.right).toBeLessThanOrEqual(page.viewportSize()!.width);
	expect(ring.top).toBeGreaterThanOrEqual(0);
	expect(ring.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
	await checkpoint('saved-plan-share-keyboard-focus', 'plan', true);

	const wishlist = page.getByTestId('plan-wishlist');
	const destination = page.locator('[data-semester="1"]');
	const save = toolbar.getByRole('button', {
		name: language === 'he' ? 'שמור' : 'Save',
		exact: true
	});
	const cancel = toolbar.getByRole('button', {
		name: language === 'he' ? 'בטל' : 'Cancel',
		exact: true
	});
	for (let pass = 1; pass <= 2; pass++) {
		const bounds = (await destination.boundingBox())!;
		const position = { x: bounds.width / 2, y: 24 };
		// Native dragover needs two mouse moves in WebKit. Keep the real drag
		// and drop lifecycle: a single dragTo move can release before insertion.
		// https://playwright.dev/docs/input#dragging-manually
		await wishlist.locator(`[data-code="${courseCode}"]`).hover();
		await page.mouse.down();
		try {
			await destination.hover({ position });
			await destination.hover({ position });
		} finally {
			await page.mouse.up();
		}
		await expect(
			destination.locator(`[data-code="${courseCode}"]`)
		).toHaveCount(1);
		await expect(save).toBeEnabled();
		await expect(cancel).toBeEnabled();
		await expect(toolbar.locator('.ui-button')).toHaveCount(3);
		await page.locator('header.title-bar').scrollIntoViewIfNeeded();
		await checkpoint(`draft-${pass}-full-shell`, 'plan', true);
		await cancel.click();
		await expect(wishlist.locator(`[data-code="${courseCode}"]`)).toHaveCount(
			1
		);
		await expect(destination.locator('[data-code]')).toHaveCount(0);
		await expect(save).toHaveCount(0);
		await expect(cancel).toHaveCount(0);
		await checkpoint(`cancel-${pass}-restored`, 'plan', pass === 2);
		expect(
			await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
		).toEqual(guest);
	}
}

for (const width of [320, 390]) {
	for (const language of ['en', 'he'] as const) {
		for (const theme of ['light', 'dark'] as const) {
			test.describe(`${width}px ${language} ${theme} navigation touch styles`, () => {
				test.use({
					viewport: { width, height: 664 },
					isMobile: true,
					hasTouch: true
				});
				test('keep exactly the active tab teal through repeated taps, hover, focus and course history', async ({
					page
				}, info) => {
					const records: Evidence[] = [];
					const checkpoint = recorder(page, info, theme, language, records);
					await prepareGuest(page, language, theme);
					try {
						await page.goto(`${origin}/app/plan`);
						await expectRoute(page, 'plan', language);
						await expect(page.getByTestId('pwa-status')).toHaveAttribute(
							'data-state',
							'ready',
							{ timeout: 60_000 }
						);
						const timeOrigin = await page.evaluate(
							() => performance.timeOrigin
						);
						const initial = await checkpoint('initial-plan', 'plan', true);
						expect(initial.fineHover).toBe(false);

						for (let pass = 1; pass <= 2; pass++) {
							for (const target of targets) {
								const prefix = `pass-${pass}-${target}`;
								await navLink(page, target).tap();
								await expectRoute(page, target, language);
								await checkpoint(`${prefix}-native-tap`, target, pass === 1);
								await navLink(page, target).hover();
								await checkpoint(`${prefix}-active-hover`, target);
								await navLink(
									page,
									targets[(targets.indexOf(target) + 1) % targets.length]
								).hover();
								await checkpoint(`${prefix}-inactive-hover`, target);
								await page.mouse.move(0, 0);
								await checkpoint(`${prefix}-mouse-away`, target);
								await focusFromKeyboard(page, target);
								const focused = await checkpoint(
									`${prefix}-keyboard-focus`,
									target,
									pass === 2 && target === 'settings'
								);
								expectKeyboardFocus(focused, target, theme);
							}
						}

						// Detail is deliberately not a top-level tab. Test both real card
						// entry points and browser Back rather than setting the URL directly.
						for (const target of ['plan', 'catalog'] as const) {
							await navLink(page, target).tap();
							await expectRoute(page, target, language);
							await checkpoint(`${target}-before-course`, target);
							const card =
								target === 'plan'
									? page
											.getByTestId('plan-wishlist')
											.locator(`[data-code="${courseCode}"]`)
									: page
											.locator(
												`.catalog-page a[href="/app/course/${courseCode}"]`
											)
											.first();
							await card.tap();
							await expect(page).toHaveURL(
								`${origin}/app/course/${courseCode}`
							);
							await expect(page.locator('h1.course-name')).toHaveText(
								courses[courseCode].name
							);
							await page.locator('header.title-bar').scrollIntoViewIfNeeded();
							await checkpoint(
								`${target}-course-detail`,
								null,
								target === 'plan'
							);
							await navLink(page, target).hover();
							await checkpoint(`${target}-course-hover`, null);
							await page.goBack();
							await expectRoute(page, target, language);
							await page.locator('header.title-bar').scrollIntoViewIfNeeded();
							await checkpoint(`${target}-back-restored`, target, true);
						}
						expect(await page.evaluate(() => performance.timeOrigin)).toBe(
							timeOrigin
						);
						expect(
							await page.evaluate(() =>
								JSON.parse(localStorage.getItem('userData')!)
							)
						).toEqual(guest);

						// The brand intentionally leaves the console through a native
						// document navigation. Only the saved guest plan is in scope.
						const brand = page.locator('header.title-bar .brand');
						await expect(brand).toHaveAttribute('href', '/');
						await expect(brand).toHaveAttribute('data-sveltekit-reload', '');
						await brand.tap();
						await expect(page).toHaveURL(`${origin}/`);
						await expect(page.locator('.landing')).toHaveAttribute(
							'dir',
							language === 'he' ? 'rtl' : 'ltr'
						);
						await expect(page.locator('.console-shell')).toHaveCount(0);
						expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(
							timeOrigin
						);
						expect(
							await page.evaluate(() =>
								JSON.parse(localStorage.getItem('userData')!)
							)
						).toEqual(guest);
						await page.locator('header a[href="/app/"]').tap();
						await expectRoute(page, 'plan', language);
						await expect(page.getByTestId('pwa-status')).toHaveAttribute(
							'data-state',
							'ready',
							{ timeout: 60_000 }
						);
						await checkpoint('brand-roundtrip-saved-plan', 'plan', true);
						expect(
							await page.evaluate(() =>
								JSON.parse(localStorage.getItem('userData')!)
							)
						).toEqual(guest);
					} finally {
						await saveEvidence(info, records);
					}
				});
			});
		}
	}
}

for (const width of [320, 390, 1180]) {
	for (const language of ['en', 'he'] as const) {
		test.describe(`${width}px ${language} fine-pointer navigation hover and compact plan toolbar`, () => {
			test.use({
				viewport: { width, height: 664 },
				isMobile: false,
				hasTouch: false
			});
			for (const theme of ['light', 'dark'] as const) {
				test(`${theme}: active color and keyboard ring survive active and inactive hover`, async ({
					page
				}, info) => {
					const records: Evidence[] = [];
					const checkpoint = recorder(page, info, theme, language, records);
					await prepareGuest(page, language, theme);
					try {
						await page.goto(`${origin}/app/plan`);
						await expectRoute(page, 'plan', language);
						await expect(page.getByTestId('pwa-status')).toHaveAttribute(
							'data-state',
							'ready',
							{ timeout: 60_000 }
						);
						await checkpoint('saved-plan-full-shell', 'plan', true);
						await expectPlanDraftAndCancel(page, checkpoint, language);
						for (const target of targets) {
							await navLink(page, target).click();
							await expectRoute(page, target, language);
							const initial = await checkpoint(`${target}-clicked`, target);
							expect(
								initial.fineHover,
								'exercise the real fine-pointer media rule'
							).toBe(true);
							await navLink(page, target).hover();
							const hovered = await checkpoint(
								`${target}-active-hover`,
								target
							);
							expect(
								hovered.links.find(({ href }) => href === `/app/${target}`)!
									.hover
							).toBe(true);
							await focusFromKeyboard(page, target);
							const focused = await checkpoint(
								`${target}-hover-and-focus`,
								target
							);
							expectKeyboardFocus(focused, target, theme);
							const inactive =
								targets[(targets.indexOf(target) + 1) % targets.length];
							await navLink(page, inactive).hover();
							const inactiveHover = await checkpoint(
								`${target}-inactive-hover-focused`,
								target,
								true
							);
							expect(
								inactiveHover.links.find(
									({ href }) => href === `/app/${inactive}`
								)!.hover
							).toBe(true);
							expectKeyboardFocus(inactiveHover, target, theme);
							expect(
								inactiveHover.links.find(
									({ href }) => href === `/app/${target}`
								)!.outline
							).toEqual(
								focused.links.find(({ href }) => href === `/app/${target}`)!
									.outline
							);
							await page.mouse.move(0, 0);
							const moved = await checkpoint(
								`${target}-mouse-away-focused`,
								target
							);
							expectKeyboardFocus(moved, target, theme);
						}
					} finally {
						await saveEvidence(info, records);
					}
				});
			}
		});
	}
}
