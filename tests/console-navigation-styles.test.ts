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
// Read expectations from the real checked-in snapshot, without replacing responses.
const courses = JSON.parse(
	readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
) as Record<string, { name: string }>;
const guest = {
	degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
	semesters: [[], [], []],
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
		return {
			url: location.href,
			viewport: { width: innerWidth, height: innerHeight },
			theme: document.documentElement.dataset.theme,
			fineHover: matchMedia('(hover: hover) and (pointer: fine)').matches,
			documentOverflow: document.documentElement.scrollWidth - innerWidth,
			scrollX,
			header: {
				...box(header),
				direction: header.getAttribute('dir'),
				items: ['.brand', '.header-search', 'nav'].map((selector) =>
					box(header.querySelector(selector)!)
				)
			},
			links: [...header.querySelectorAll<HTMLAnchorElement>('nav a')].map(
				(link) => {
					const style = getComputedStyle(link);
					const icon = link.querySelector('svg path');
					return {
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
						overflow: link.scrollWidth - link.clientWidth
					};
				}
			)
		};
	});
}

type Navigation = Awaited<ReturnType<typeof measureNavigation>>;
type Evidence = {
	name: string;
	expectedActive: Target | null;
	state: Navigation;
};

function expectNavigation(
	state: Navigation,
	active: Target | null,
	theme: Theme
) {
	const palette = colors[theme];
	expect(state.theme).toBe(theme);
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
	records: Evidence[]
) {
	return async (name: string, active: Target | null, screenshot = false) => {
		await settle(page);
		const state = await measureNavigation(page);
		records.push({ name, expectedActive: active, state });
		// Capture before assertions so an unexpected sticky/hover color is visible.
		if (screenshot) await capture(page, info, name);
		expectNavigation(state, active, theme);
		return state;
	};
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
					const checkpoint = recorder(page, info, theme, records);
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
						const initial = await checkpoint('initial-plan', 'plan');
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

test.describe('fine-pointer navigation hover styles', () => {
	test.use({
		viewport: { width: 390, height: 664 },
		isMobile: false,
		hasTouch: false
	});
	for (const theme of ['light', 'dark'] as const) {
		test(`${theme}: active color and keyboard ring survive active and inactive hover`, async ({
			page
		}, info) => {
			const records: Evidence[] = [];
			const checkpoint = recorder(page, info, theme, records);
			await prepareGuest(page, 'en', theme);
			try {
				await page.goto(`${origin}/app/plan`);
				await expectRoute(page, 'plan', 'en');
				await expect(page.getByTestId('pwa-status')).toHaveAttribute(
					'data-state',
					'ready',
					{ timeout: 60_000 }
				);
				for (const target of targets) {
					await navLink(page, target).click();
					await expectRoute(page, target, 'en');
					const initial = await checkpoint(`${target}-clicked`, target);
					expect(
						initial.fineHover,
						'exercise the real fine-pointer media rule'
					).toBe(true);
					await navLink(page, target).hover();
					const hovered = await checkpoint(`${target}-active-hover`, target);
					expect(
						hovered.links.find(({ href }) => href === `/app/${target}`)!.hover
					).toBe(true);
					await focusFromKeyboard(page, target);
					const focused = await checkpoint(`${target}-hover-and-focus`, target);
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
						inactiveHover.links.find(({ href }) => href === `/app/${inactive}`)!
							.hover
					).toBe(true);
					expectKeyboardFocus(inactiveHover, target, theme);
					expect(
						inactiveHover.links.find(({ href }) => href === `/app/${target}`)!
							.outline
					).toEqual(
						focused.links.find(({ href }) => href === `/app/${target}`)!.outline
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
