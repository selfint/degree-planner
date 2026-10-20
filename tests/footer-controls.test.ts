import { writeFileSync } from 'node:fs';
import { createServer, request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';
import {
	expect,
	test as base,
	type Locator,
	type Page,
	type Request,
	type TestInfo
} from '@playwright/test';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;
type RefreshProxy = {
	origin: string;
	failCourses: boolean;
	failedRequests: { url: string; status: number }[];
	courseResponses: { url: string; status: number }[];
};

const test = base.extend<{ refreshProxy: RefreshProxy }>({
	refreshProxy: async ({}, use) => {
		const proxy: RefreshProxy = {
			origin: '',
			failCourses: false,
			failedRequests: [],
			courseResponses: []
		};
		// WebKit's service-worker-controlled requests bypass page.route, even
		// when the worker lets public data pass through. Inject HTTP 503 at the
		// actual loopback server instead of replacing browser APIs or JSON data.
		// Successful responses stream untouched from the real production build.
		const server = createServer((request, response) => {
			const url = new URL(request.url ?? '/', proxy.origin);
			if (proxy.failCourses && url.pathname === '/courseData.json') {
				proxy.failedRequests.push({ url: url.href, status: 503 });
				response.writeHead(503, { 'cache-control': 'no-store' });
				response.end();
				return;
			}
			const upstreamUrl = new URL(request.url ?? '/', origin);
			const requestUpstream =
				upstreamUrl.protocol === 'https:' ? requestHttps : requestHttp;
			const upstream = requestUpstream(
				upstreamUrl,
				{
					method: request.method,
					headers: { ...request.headers, host: upstreamUrl.host }
				},
				(upstreamResponse) => {
					const status = upstreamResponse.statusCode ?? 502;
					if (url.pathname === '/courseData.json')
						proxy.courseResponses.push({ url: url.href, status });
					response.writeHead(status, upstreamResponse.headers);
					upstreamResponse.on('error', () => response.destroy());
					upstreamResponse.pipe(response);
				}
			);
			upstream.on('error', () => response.destroy());
			request.on('aborted', () => upstream.destroy());
			response.on('close', () => upstream.destroy());
			request.pipe(upstream);
		});
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(0, '127.0.0.1', () => {
				server.off('error', reject);
				resolve();
			});
		});
		const address = server.address();
		if (!address || typeof address === 'string')
			throw new Error('Missing public-data proxy address');
		proxy.origin = `http://127.0.0.1:${address.port}`;
		try {
			await use(proxy);
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			);
		}
	}
});

type Language = 'en' | 'he';
type Theme = 'light' | 'dark';
// Keep the real console lifecycle in these full-shell footer screenshots.
// Playwright's blocked registration returns undefined, an artificial error state.
test.use({ serviceWorkers: 'allow' });
type GuestPlan = {
	degree: string[];
	semesters: string[][];
	currentSemester: number;
	exemptions: string[];
	wishlist: string[];
};
const guest: GuestPlan = {
	degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
	semesters: [[], [], []],
	currentSemester: 0,
	exemptions: [],
	wishlist: []
};

const populatedGuest: GuestPlan = {
	...guest,
	semesters: [['02340114'], ['01140052'], []],
	currentSemester: 1,
	exemptions: ['01040031', '01040166'],
	wishlist: ['02340141']
};

async function prepareGuest(
	page: Page,
	language: Language,
	theme: Theme,
	plan = guest,
	appOrigin = origin
) {
	// Use the real local guest/bootstrap and checked-in public catalog data.
	// No mocked catalog responses, Firebase account, or replacement browser APIs.
	await page.addInitScript(
		({ language, theme, guest }) => {
			if (localStorage.getItem('userData')) return;
			localStorage.setItem('lang', language);
			localStorage.setItem('theme', theme);
			localStorage.setItem('version', '4');
			localStorage.setItem('userData', JSON.stringify(guest));
		},
		{ language, theme, guest: plan }
	);
	// A fresh context stays a guest; external auth/analytics requests are blocked.
	await page.route('**/*', (route) =>
		new URL(route.request().url()).origin === appOrigin
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

async function expectPreferences(page: Page, language: Language, theme: Theme) {
	const footer = page.locator('footer');
	await expect(footer.locator('.theme-toggle')).toHaveAccessibleName(
		language === 'he' ? 'מצב בהיר' : 'Light mode'
	);
	await expect(footer.locator('.theme-toggle')).toHaveAttribute(
		'aria-pressed',
		String(theme === 'light')
	);
	await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
	await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
	await expect(footer.getByRole('combobox')).toHaveAccessibleName(
		language === 'he' ? 'שפה' : 'Language'
	);
	await expect(footer.locator('option:checked')).toHaveText(
		language === 'he' ? 'עב' : 'en'
	);
	await expect
		.poll(() =>
			page.evaluate(() => ({
				language: localStorage.getItem('lang'),
				theme: localStorage.getItem('theme')
			}))
		)
		.toEqual({ language, theme });
}

async function expectSettingsReady(page: Page, language: Language) {
	await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('#console-boot')).toHaveCount(0);
	await expect(
		page.locator('main').getByRole('combobox', {
			name: language === 'he' ? 'תואר' : 'Degree',
			exact: true
		})
	).toHaveValue(guest.degree[2], { timeout: 30_000 });
	await expect(page.locator('.console-shell')).toHaveAttribute(
		'dir',
		language === 'he' ? 'rtl' : 'ltr'
	);
	await expect(page.locator('.settings-page .no-path')).toHaveText(
		language === 'he' ? 'אין מסלולים בתואר' : 'Degree has no paths'
	);
	await expect(page.locator('footer .theme-toggle')).toBeEnabled();
	await expect(page.getByTestId('pwa-status')).toHaveAttribute(
		'data-state',
		'ready',
		{ timeout: 60_000 }
	);
}

async function expectGuestSettings(
	page: Page,
	language: Language,
	populated = false
) {
	const settings = page.locator('.settings-page');
	await expect(settings.locator('.account-identity')).toHaveText(
		language === 'he' ? 'אורח' : 'Guest'
	);
	await expect(settings.locator('.degree-section')).toBeVisible();
	await expect(settings.locator('.semester-section')).toBeVisible();
	await expect(settings.locator('.upload-section')).toHaveCount(
		populated ? 0 : 1
	);
	await expect(settings.locator('.exemptions-section')).toHaveCount(
		populated ? 1 : 0
	);
	if (populated) {
		await expect(
			settings.locator('.exemptions-section').getByRole('heading')
		).toHaveText(language === 'he' ? 'זיכויים' : 'Exemptions');
		await expect(
			settings.locator('.exemptions-section .course-card')
		).toHaveCount(2);
		for (const code of populatedGuest.exemptions) {
			const course = settings.locator(`a[href="/app/course/${code}"]`);
			await expect(course.locator('.course-code')).toHaveText(code);
			// Wait for authentic public course names, not only seed IDs/placeholders.
			await expect(course.locator('.course-name')).not.toBeEmpty();
		}
	}
}

async function expectHealthyPwa(page: Page, language: Language) {
	const status = page.getByTestId('pwa-status');
	await expect(status).toHaveAttribute('data-state', 'ready', {
		timeout: 60_000
	});
	await expect(status).toHaveAttribute('data-refresh-state', 'idle', {
		timeout: 30_000
	});
	await expect(status.locator('.readiness')).toHaveText(
		language === 'he'
			? 'כל הקורסים זמינים ללא אינטרנט'
			: 'All courses ready offline'
	);
	await expect(status.locator('.readiness')).toHaveClass(/\bsr-only\b/);
	await expect(page.getByTestId('pwa-error')).toHaveCount(0);
	await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
	await expect(page.getByTestId('pwa-install-help')).toHaveCount(0);
	await expect(page.getByTestId('pwa-status-details')).toHaveCount(0);
}

async function measureFooter(page: Page) {
	return page.locator('footer').evaluate((footer) => {
		const box = (element: Element) => {
			const { left, right, top, bottom, width, height } =
				element.getBoundingClientRect();
			return {
				left,
				right,
				top,
				bottom,
				width,
				height,
				centerX: left + width / 2,
				centerY: top + height / 2
			};
		};
		const textBox = (element: Element) => {
			const range = document.createRange();
			range.selectNodeContents(element);
			const { left, right, top, bottom, width, height } =
				range.getBoundingClientRect();
			const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
			const rects: {
				left: number;
				right: number;
				top: number;
				bottom: number;
			}[] = [];
			while (walker.nextNode()) {
				if (!walker.currentNode.textContent?.trim()) continue;
				const textRange = document.createRange();
				textRange.selectNodeContents(walker.currentNode);
				for (const rect of textRange.getClientRects()) {
					if (rect.width > 0 && rect.height > 0)
						rects.push({
							left: rect.left,
							right: rect.right,
							top: rect.top,
							bottom: rect.bottom
						});
				}
			}
			return {
				left,
				right,
				top,
				bottom,
				width,
				height,
				rects,
				lines: new Set(rects.map((rect) => Math.round(rect.top))).size
			};
		};
		const main = footer.querySelector('.footer-main')!;
		const mainStyle = getComputedStyle(main);
		const links = footer.querySelector('.footer-links')!;
		const credit = footer.querySelector('.footer-credit')!;
		const report = footer.querySelector('.footer-report')!;
		const toggle = footer.querySelector<HTMLButtonElement>('.theme-toggle')!;
		const select = footer.querySelector<HTMLSelectElement>('select')!;
		const selectStyle = getComputedStyle(select);
		const chevrons = footer.querySelectorAll(
			'.language-control .language-chevron'
		);
		const chevron = chevrons[0];
		const chevronStyle = chevron ? getComputedStyle(chevron) : null;
		const selectedText = select.selectedOptions[0].text;
		// Native option glyph rectangles are not exposed consistently by Chromium
		// and WebKit. Record the real control's alignment and text-fit metrics;
		// the viewport PNG also shows the native selected text and single chevron.
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d')!;
		context.font = selectStyle.font;
		context.textAlign = 'left';
		context.direction = selectStyle.direction as CanvasDirection;
		const text = context.measureText(selectedText);
		const selectBox = box(select);
		const contentLeft =
			selectBox.left + select.clientLeft + parseFloat(selectStyle.paddingLeft);
		const contentTop =
			selectBox.top + select.clientTop + parseFloat(selectStyle.paddingTop);
		const contentWidth =
			select.clientWidth -
			parseFloat(selectStyle.paddingLeft) -
			parseFloat(selectStyle.paddingRight);
		const contentHeight =
			select.clientHeight -
			parseFloat(selectStyle.paddingTop) -
			parseFloat(selectStyle.paddingBottom);
		const textAdvanceLeft = contentLeft + (contentWidth - text.width) / 2;
		const glyphInk = {
			left: textAdvanceLeft - text.actualBoundingBoxLeft,
			right: textAdvanceLeft + text.actualBoundingBoxRight
		};
		const footerStyle = getComputedStyle(footer);
		const separatorWidth =
			footer.clientWidth -
			parseFloat(footerStyle.paddingLeft) -
			parseFloat(footerStyle.paddingRight);
		const separators = [footer, ...footer.querySelectorAll('*')].flatMap(
			(element) => {
				const bounds = box(element);
				if (bounds.width < separatorWidth - 1) return [];
				const style = getComputedStyle(element);
				return [
					{ edge: 'top', width: parseFloat(style.borderTopWidth) },
					{ edge: 'bottom', width: parseFloat(style.borderBottomWidth) }
				]
					.filter(({ width }) => width > 0)
					.map(({ edge, width }) => ({
						element: element === footer ? 'footer' : element.tagName,
						edge,
						width
					}));
			}
		);
		const pwa = footer.querySelector('[data-testid="pwa-footer-row"]');
		const pwaControls = footer.querySelector('.pwa-footer-controls');
		const status = footer.querySelector('[data-testid="pwa-status"]');
		const readiness = status?.querySelector('.readiness');
		const readinessStyle = readiness ? getComputedStyle(readiness) : null;
		const settings = document.querySelector('.settings-page');
		const noPath = settings?.querySelector('.no-path');
		const noPathStyle = noPath ? getComputedStyle(noPath) : null;
		const identity = settings?.querySelector('.account-identity');
		const guestHeading = identity?.querySelector('h2');
		const settingsTitle = settings?.querySelector(':scope > h1');
		return {
			url: location.href,
			viewport: { width: innerWidth, height: innerHeight },
			scrollX,
			scrollY,
			rootSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
			theme: document.documentElement.dataset.theme,
			direction: getComputedStyle(footer).direction,
			documentOverflow: document.documentElement.scrollWidth - innerWidth,
			pageRegions: [
				document.documentElement,
				document.body,
				document.querySelector('.console-shell'),
				document.querySelector('main'),
				settings
			]
				.filter(
					(element): element is HTMLElement => element instanceof HTMLElement
				)
				.map((element) => ({
					element: element.className || element.tagName,
					...box(element),
					scrollWidth: element.scrollWidth,
					clientWidth: element.clientWidth,
					overflow: element.scrollWidth - element.clientWidth
				})),
			guestIdentity: guestHeading
				? {
						...box(guestHeading),
						container: box(identity!),
						text: textBox(guestHeading)
					}
				: null,
			settingsStart:
				settings && settingsTitle
					? {
							contentTop:
								settings.getBoundingClientRect().top +
								parseFloat(getComputedStyle(settings).paddingTop) +
								parseFloat(getComputedStyle(settings).borderTopWidth),
							headingWrapper: settings.querySelectorAll(
								':scope > .page-heading'
							).length,
							title: {
								...box(settingsTitle),
								text: settingsTitle.textContent?.trim(),
								position: getComputedStyle(settingsTitle).position,
								clip: getComputedStyle(settingsTitle).clip
							}
						}
					: null,
			noPath: noPath
				? {
						...box(noPath),
						field: box(noPath.closest('.no-path-field')!),
						text: textBox(noPath),
						content: noPath.textContent?.trim(),
						fontSize: parseFloat(noPathStyle!.fontSize),
						lineHeight: parseFloat(noPathStyle!.lineHeight),
						whiteSpace: noPathStyle!.whiteSpace,
						overflow: noPath.scrollWidth - noPath.clientWidth
					}
				: null,
			settingsTypography: [
				...(settings?.querySelectorAll('.settings-field') ?? [])
			].map((field) => {
				const label = field.querySelector(':scope > span');
				const select = field.querySelector('select');
				return {
					label: label?.textContent?.trim(),
					labelBox: label ? box(label) : null,
					labelText: label ? textBox(label) : null,
					labelLineHeight: label
						? parseFloat(getComputedStyle(label).lineHeight)
						: null,
					fieldSize: parseFloat(getComputedStyle(field).fontSize),
					labelSize: label
						? parseFloat(getComputedStyle(label).fontSize)
						: null,
					selectSize: select
						? parseFloat(getComputedStyle(select).fontSize)
						: null,
					optionSizes: select
						? [
								...new Set(
									[...select.options].map((option) =>
										parseFloat(getComputedStyle(option).fontSize)
									)
								)
							]
						: []
				};
			}),
			settingsSections: [
				...(settings?.querySelectorAll(':scope > section') ?? [])
			].map((element) => {
				const style = getComputedStyle(element);
				return {
					element: element.className,
					...box(element),
					borderTop: parseFloat(style.borderTopWidth),
					borderBottom: parseFloat(style.borderBottomWidth)
				};
			}),
			footer: {
				...box(footer),
				overflow: footer.scrollWidth - footer.clientWidth
			},
			firstRow: {
				...box(main),
				display: mainStyle.display,
				columns: mainStyle.gridTemplateColumns.split(/\s+/),
				columnGap: parseFloat(mainStyle.columnGap)
			},
			links: {
				...box(links),
				credit: { ...box(credit), text: textBox(credit) },
				report: { ...box(report), text: textBox(report) }
			},
			controls: box(footer.querySelector('.preference-controls')!),
			toggle: {
				...box(toggle),
				icon: box(toggle.querySelector('svg')!),
				overflow: toggle.scrollWidth - toggle.clientWidth
			},
			language: {
				...box(select),
				frame: box(select.parentElement!),
				label: box(select.closest('label')!),
				isNative: select instanceof HTMLSelectElement,
				type: select.type,
				appearance: selectStyle.appearance,
				textAlign: selectStyle.textAlign,
				textAlignLast: selectStyle.textAlignLast,
				whiteSpace: selectStyle.whiteSpace,
				paddingInlineStart: parseFloat(selectStyle.paddingInlineStart),
				paddingInlineEnd: parseFloat(selectStyle.paddingInlineEnd),
				paddingLeft: parseFloat(selectStyle.paddingLeft),
				paddingRight: parseFloat(selectStyle.paddingRight),
				paddingTop: parseFloat(selectStyle.paddingTop),
				paddingBottom: parseFloat(selectStyle.paddingBottom),
				selectedText,
				options: [...select.options].map((option) => option.text),
				contentBox: {
					left: contentLeft,
					right: contentLeft + contentWidth,
					top: contentTop,
					bottom: contentTop + contentHeight,
					width: contentWidth,
					height: contentHeight,
					centerX: contentLeft + contentWidth / 2
				},
				glyphInk,
				textAdvance: {
					left: textAdvanceLeft,
					right: textAdvanceLeft + text.width
				},
				chevronCount: chevrons.length,
				chevron: chevron
					? {
							...box(chevron),
							pointerEvents: chevronStyle!.pointerEvents,
							ariaHidden: chevron.getAttribute('aria-hidden'),
							focusable: chevron.getAttribute('focusable')
						}
					: null,
				textWidth: text.width,
				textHeight:
					text.actualBoundingBoxAscent + text.actualBoundingBoxDescent,
				contentWidth:
					select.clientWidth -
					parseFloat(selectStyle.paddingLeft) -
					parseFloat(selectStyle.paddingRight),
				contentHeight:
					select.clientHeight -
					parseFloat(selectStyle.paddingTop) -
					parseFloat(selectStyle.paddingBottom),
				overflow: select.scrollWidth - select.clientWidth
			},
			pwa: pwa ? box(pwa) : null,
			pwaControls: pwaControls ? box(pwaControls) : null,
			pwaStatus: status
				? {
						state: status.getAttribute('data-state'),
						refreshState: status.getAttribute('data-refresh-state'),
						hasError: !!status.querySelector('[data-testid="pwa-error"]'),
						readiness: readiness
							? {
									...box(readiness),
									text: readiness.textContent?.trim(),
									screenReaderOnly: readiness.classList.contains('sr-only'),
									position: readinessStyle!.position,
									clip: readinessStyle!.clip
								}
							: null
					}
				: null,
			pwaRows: footer.querySelectorAll('[data-testid="pwa-footer-row"]').length,
			separators
		};
	});
}

type Geometry = Awaited<ReturnType<typeof measureFooter>>;

function expectMatchingControls(geometry: Geometry, compact = true) {
	const { toggle, language, rootSize, viewport, firstRow, links, controls } =
		geometry;
	const start = geometry.direction === 'rtl' ? 'right' : 'left';
	const end = geometry.direction === 'rtl' ? 'left' : 'right';
	const aligned = (actual: number, expected: number, label: string) =>
		expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(1);
	expect(firstRow.display, 'stable footer composition').toBe('grid');
	expect(firstRow.columns, 'two fixed layout groups').toHaveLength(2);
	aligned(links[start], firstRow[start], 'links at logical start');
	aligned(controls[end], firstRow[end], 'preferences at logical end');
	aligned(links.centerY, firstRow.centerY, 'links centered on the main row');
	aligned(
		controls.centerY,
		firstRow.centerY,
		'controls centered on the main row'
	);
	expect(
		links.credit.text.lines,
		'entire author credit stays on one rendered line'
	).toBe(1);
	for (const rect of links.credit.text.rects) {
		expect(rect.left).toBeGreaterThanOrEqual(links.credit.left - 0.5);
		expect(rect.right).toBeLessThanOrEqual(links.credit.right + 0.5);
		expect(rect.top).toBeGreaterThanOrEqual(links.credit.top - 0.5);
		expect(rect.bottom).toBeLessThanOrEqual(links.credit.bottom + 0.5);
	}
	for (const link of [links.credit, links.report]) {
		aligned(link[start], links[start], 'stacked links share logical start');
		aligned(
			link.text[start],
			links[start],
			'link text starts at the logical edge'
		);
		expect(link.left).toBeGreaterThanOrEqual(links.left - 1);
		expect(link.right).toBeLessThanOrEqual(links.right + 1);
	}
	expect(
		links.report.top,
		'report link stays below author credit'
	).toBeGreaterThanOrEqual(links.credit.bottom - 1);
	expect(
		links.report.top - links.credit.bottom,
		'compact link stack'
	).toBeLessThanOrEqual(0.25 * rootSize);
	const groupGap =
		geometry.direction === 'rtl'
			? links.left - controls.right
			: controls.left - links.right;
	aligned(
		groupGap,
		firstRow.columnGap,
		'links and preferences never wrap or overlap'
	);
	expect(groupGap).toBeGreaterThanOrEqual(0.5 * rootSize);
	expect(geometry.controls.height).toBeCloseTo(toggle.height, 2);
	expect(geometry.controls.width).toBeGreaterThanOrEqual(
		toggle.width + language.width
	);
	for (const control of [toggle, language, language.frame, language.label]) {
		expect(control.width, 'matching outer widths').toBeCloseTo(toggle.width, 2);
		expect(control.height, 'matching outer heights').toBeCloseTo(
			toggle.height,
			2
		);
		expect(control.centerY, 'one control centerline').toBeCloseTo(
			toggle.centerY,
			2
		);
		expect(control.width).toBeCloseTo(3 * rootSize, 2);
		expect(control.height).toBeCloseTo((compact ? 2.25 : 2.75) * rootSize, 2);
		expect(control.left).toBeGreaterThanOrEqual(0);
		expect(control.right).toBeLessThanOrEqual(viewport.width);
		expect(control.top).toBeGreaterThanOrEqual(0);
		expect(control.bottom).toBeLessThanOrEqual(viewport.height);
	}
	expect(toggle.icon.centerX, 'centered theme icon').toBeCloseTo(
		toggle.centerX,
		2
	);
	expect(toggle.icon.centerY, 'centered theme icon').toBeCloseTo(
		toggle.centerY,
		2
	);
	expect(language.isNative).toBe(true);
	expect(language.type).toBe('select-one');
	expect(
		language.appearance,
		'hide only the platform arrow, retaining the native select'
	).toBe('none');
	expect(language.options).toEqual(['en', 'עב']);
	expect(language.textAlign).toBe('center');
	expect(language.textAlignLast).toBe('center');
	expect(language.paddingInlineStart).toBeCloseTo(0.25 * rootSize, 2);
	expect(language.paddingInlineEnd).toBeCloseTo(rootSize, 2);
	expect(language.chevronCount, 'exactly one language chevron').toBe(1);
	expect(language.chevron).not.toBeNull();
	const chevron = language.chevron!;
	expect(
		chevron.pointerEvents,
		'chevron never intercepts the native picker'
	).toBe('none');
	expect(chevron.ariaHidden).toBe('true');
	expect(chevron.focusable).toBe('false');
	expect(chevron.width).toBeCloseTo(0.625 * rootSize, 2);
	expect(chevron.height).toBeCloseTo(0.625 * rootSize, 2);
	aligned(chevron.centerY, language.centerY, 'chevron vertically centered');
	aligned(
		Math.abs(language[end] - chevron[end]),
		0.375 * rootSize,
		'chevron at logical end'
	);
	aligned(
		(language.textAdvance.left + language.textAdvance.right) / 2,
		language.contentBox.centerX,
		'selected label centered in actual padded content box'
	);
	expect(
		language.glyphInk.left,
		'selected label ink fits its content box'
	).toBeGreaterThanOrEqual(language.contentBox.left - 1);
	expect(
		language.glyphInk.right,
		'selected label ink fits its content box'
	).toBeLessThanOrEqual(language.contentBox.right + 1);
	const textIconGap =
		geometry.direction === 'rtl'
			? language.glyphInk.left - chevron.right
			: chevron.left - language.glyphInk.right;
	expect(
		textIconGap,
		'native selected text never overlaps the chevron'
	).toBeGreaterThanOrEqual(1);
	expect(chevron.left).toBeGreaterThanOrEqual(language.left);
	expect(chevron.right).toBeLessThanOrEqual(language.right);
	expect(language.paddingTop).toBe(language.paddingBottom);
	expect(language.whiteSpace).toBe('nowrap');
	expect(language.textWidth).toBeGreaterThan(0);
	expect(
		language.textWidth,
		'unclipped native selected label'
	).toBeLessThanOrEqual(language.contentWidth);
	expect(language.textHeight).toBeLessThanOrEqual(language.contentHeight);
	for (const control of [toggle, language, geometry.footer])
		expect(control.overflow).toBeLessThanOrEqual(1);
	expect(geometry.documentOverflow, 'no horizontal page overflow').toBe(0);
	expect(Math.abs(geometry.scrollX)).toBeLessThanOrEqual(1);
	for (const region of geometry.pageRegions) {
		expect(
			region.overflow,
			`${region.element}: no full-page horizontal overflow`
		).toBeLessThanOrEqual(0);
		expect(
			region.left,
			`${region.element}: within viewport start`
		).toBeGreaterThanOrEqual(-1);
		expect(
			region.right,
			`${region.element}: within viewport end`
		).toBeLessThanOrEqual(viewport.width + 1);
	}
	if (compact) {
		expect(geometry.guestIdentity).not.toBeNull();
		const identity = geometry.guestIdentity!;
		expect(
			identity.text.lines,
			'entire guest heading stays on one rendered line'
		).toBe(1);
		for (const rect of identity.text.rects) {
			expect(rect.left).toBeGreaterThanOrEqual(
				Math.max(identity.left, identity.container.left) - 0.5
			);
			expect(rect.right).toBeLessThanOrEqual(
				Math.min(identity.right, identity.container.right) + 0.5
			);
			expect(rect.top).toBeGreaterThanOrEqual(identity.top - 0.5);
			expect(rect.bottom).toBeLessThanOrEqual(identity.bottom + 0.5);
		}
		expect(
			geometry.noPath,
			'real degree uses the no-path branch'
		).not.toBeNull();
		const noPath = geometry.noPath!;
		expect(noPath.fontSize, 'no-path uses the same 16px settings text').toBe(
			16
		);
		expect(noPath.whiteSpace).toBe('nowrap');
		expect(noPath.text.width).toBeGreaterThan(0);
		expect(
			noPath.text.height,
			'no-path text fits one line'
		).toBeLessThanOrEqual(noPath.lineHeight + 1);
		expect(
			noPath.height,
			'no-path field does not grow a second line'
		).toBeLessThanOrEqual(noPath.lineHeight + 1);
		expect(noPath.overflow, 'unclipped no-path text').toBe(0);
		expect(noPath.text.left).toBeGreaterThanOrEqual(noPath.left - 1);
		expect(noPath.text.right).toBeLessThanOrEqual(noPath.right + 1);
		expect(noPath.left).toBeGreaterThanOrEqual(noPath.field.left - 1);
		expect(noPath.right).toBeLessThanOrEqual(noPath.field.right + 1);
		expect(noPath.left).toBeGreaterThanOrEqual(0);
		expect(noPath.right).toBeLessThanOrEqual(viewport.width);
		expect(geometry.settingsTypography.length).toBeGreaterThanOrEqual(6);
		expect(
			geometry.settingsTypography.filter((field) => field.selectSize !== null)
				.length
		).toBeGreaterThanOrEqual(5);
		for (const field of geometry.settingsTypography) {
			if (field.labelText && field.labelBox && field.labelLineHeight) {
				expect(
					field.labelText.bottom - field.labelText.top,
					`${field.label}: one line`
				).toBeLessThanOrEqual(field.labelLineHeight + 1);
				expect(field.labelText.left).toBeGreaterThanOrEqual(
					field.labelBox.left - 1
				);
				expect(field.labelText.right).toBeLessThanOrEqual(
					field.labelBox.right + 1
				);
			}
			expect(field.fieldSize, `${field.label}: settings field text size`).toBe(
				16
			);
			expect(field.labelSize, `${field.label}: label matches field text`).toBe(
				16
			);
			if (field.selectSize !== null) {
				expect(
					field.selectSize,
					`${field.label}: native selected value matches label`
				).toBe(16);
				expect(
					field.optionSizes,
					`${field.label}: native options match selected value`
				).toEqual([16]);
			}
		}
		const account = geometry.settingsSections.find((section) =>
			section.element.split(/\s+/).includes('account-section')
		);
		const degree = geometry.settingsSections.find((section) =>
			section.element.split(/\s+/).includes('degree-section')
		);
		expect(account, 'guest account section renders').toBeDefined();
		expect(degree, 'degree section renders').toBeDefined();
		expect(
			geometry.settingsStart,
			'settings retain an accessible page heading'
		).not.toBeNull();
		const start = geometry.settingsStart!;
		expect(start.headingWrapper, 'no visible Settings title row remains').toBe(
			0
		);
		expect(start.title.text).toBe(
			geometry.direction === 'rtl' ? 'הגדרות' : 'Settings'
		);
		expect(start.title.position).toBe('absolute');
		expect(start.title.width).toBe(1);
		expect(start.title.height).toBe(1);
		expect(start.title.clip).toBe('rect(0px, 0px, 0px, 0px)');
		aligned(
			account!.top,
			start.contentTop,
			'account controls are the first visible settings row'
		);
		expect(
			account!.bottom,
			'guest identity stays above degree controls'
		).toBeLessThanOrEqual(degree!.top);
	}
	for (const section of geometry.settingsSections) {
		expect(
			section.borderTop,
			`${section.element}: no internal top separator`
		).toBe(0);
		expect(
			section.borderBottom,
			`${section.element}: no internal bottom separator`
		).toBe(0);
	}
	expect(geometry.separators, 'one footer separator').toEqual([
		{ element: 'footer', edge: 'top', width: 1 }
	]);
	if (compact) {
		expect(geometry.pwaRows).toBe(1);
		expect(
			geometry.pwa,
			'PWA row stays below the preference row'
		).not.toBeNull();
		expect(geometry.settingsSections.length).toBeGreaterThanOrEqual(4);
		expect(geometry.pwa!.top).toBeGreaterThanOrEqual(firstRow.bottom);
		expect(
			geometry.pwa!.top - firstRow.bottom,
			'compact PWA row gap'
		).toBeLessThanOrEqual(0.5 * rootSize);
		aligned(geometry.pwa!.left, firstRow.left, 'PWA row left edge');
		aligned(geometry.pwa!.right, firstRow.right, 'PWA row right edge');
		expect(geometry.pwaControls).not.toBeNull();
		aligned(
			geometry.pwaControls!.top,
			geometry.pwa!.top,
			'PWA controls start the separate row'
		);
		expect(
			geometry.pwaControls!.height,
			'single compact status/control line'
		).toBeLessThanOrEqual(2.25 * rootSize + 1);
		if (!geometry.pwaStatus!.hasError) {
			const readiness = geometry.pwaStatus!.readiness!;
			expect(
				readiness.screenReaderOnly,
				'healthy ready text is quiet visually'
			).toBe(true);
			expect(readiness.position).toBe('absolute');
			expect(readiness.width).toBeLessThanOrEqual(1);
			expect(readiness.height).toBeLessThanOrEqual(1);
			expect(readiness.clip).not.toBe('auto');
		}
		expect(geometry.pwa!.top).toBeGreaterThanOrEqual(0);
		expect(geometry.pwa!.bottom).toBeLessThanOrEqual(viewport.height);
		expect(geometry.pwa!.left).toBeGreaterThanOrEqual(0);
		expect(geometry.pwa!.right).toBeLessThanOrEqual(viewport.width);
	}
}

async function capture(
	page: Page,
	info: TestInfo,
	name: string,
	{
		fullPage = false,
		evidence = {}
	}: {
		fullPage?: boolean;
		evidence?: Record<string, unknown>;
	} = {}
) {
	const footer = page.locator('footer');
	await settle(page);
	await footer.evaluate((element) =>
		element.scrollIntoView({ block: 'end', inline: 'nearest' })
	);
	await settle(page);
	const geometry = await measureFooter(page);
	const screenshotPath = info.outputPath(`${name}.png`);
	await page.screenshot({
		path: screenshotPath,
		fullPage: false,
		animations: 'disabled'
	});
	await info.attach(name, { path: screenshotPath, contentType: 'image/png' });
	if (fullPage) {
		// The primary PNG and its measured boxes always use the actual mobile
		// viewport. Full-document evidence is supplemental; it can affect RTL
		// screenshot layout in some browser versions.
		const fullPagePath = info.outputPath(`${name}-full-page.png`);
		await page.screenshot({
			path: fullPagePath,
			fullPage: true,
			animations: 'disabled'
		});
		await info.attach(`${name}-full-page`, {
			path: fullPagePath,
			contentType: 'image/png'
		});
	}
	const geometryPath = info.outputPath(`${name}-geometry.json`);
	writeFileSync(
		geometryPath,
		JSON.stringify(
			{ ...geometry, supplementalFullPageScreenshot: fullPage, evidence },
			null,
			2
		)
	);
	await info.attach(`${name}-geometry`, {
		path: geometryPath,
		contentType: 'application/json'
	});
	return geometry;
}

async function expectVisibleFocus(control: Locator, frame: Locator) {
	await expect(control).toBeFocused();
	expect(
		await control.evaluate((element) => element.matches(':focus-visible'))
	).toBe(true);
	const ring = await frame.evaluate((element) => {
		const style = getComputedStyle(element);
		const bounds = element.getBoundingClientRect();
		const extent =
			parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
		return {
			style: style.outlineStyle,
			width: parseFloat(style.outlineWidth),
			offset: parseFloat(style.outlineOffset),
			color: style.outlineColor,
			inViewport:
				bounds.left - extent >= 0 &&
				bounds.right + extent <= innerWidth &&
				bounds.top - extent >= 0 &&
				bounds.bottom + extent <= innerHeight
		};
	});
	expect(ring.style).toBe('solid');
	expect(ring.width).toBeGreaterThanOrEqual(2);
	expect(ring.offset).toBeGreaterThanOrEqual(0);
	expect(ring.color).not.toBe('rgba(0, 0, 0, 0)');
	expect(ring.inViewport).toBe(true);
}

for (const viewport of [
	{ width: 320, height: 568 },
	{ width: 390, height: 664 }
]) {
	for (const language of ['en', 'he'] as const) {
		for (const theme of ['light', 'dark'] as const) {
			test.describe(`${viewport.width}px ${language} ${theme} footer controls`, () => {
				test.use({ viewport, isMobile: true, hasTouch: true });
				test.setTimeout(90_000);

				test('match in the full settings shell through touch, native selection, keyboard and reload', async ({
					page
				}, info) => {
					await prepareGuest(page, language, theme);
					await page.goto(`${origin}/app/settings`);
					await expectSettingsReady(page, language);
					await expectPreferences(page, language, theme);
					await expectGuestSettings(page, language);
					await expectHealthyPwa(page, language);
					const footer = page.locator('footer');
					const toggle = footer.locator('.theme-toggle');
					const select = footer.locator('select');
					await expect(footer).toHaveCount(1);
					await expect(footer.getByTestId('pwa-footer-row')).toHaveCount(1);
					await expect(footer.getByTestId('pwa-install-help')).toHaveCount(0);
					await expect(page.getByTestId('pwa-update-banner')).toHaveCount(0);
					await expect(
						page.locator('header.title-bar').getByTestId('pwa-status')
					).toHaveCount(0);
					await expect(
						footer.locator('hr, [role="separator"], [role="listbox"]')
					).toHaveCount(0);
					expectMatchingControls(
						await capture(page, info, 'settings-empty-initial', {
							fullPage: true
						})
					);

					const changedTheme = theme === 'light' ? 'dark' : 'light';
					await toggle.tap();
					await expectPreferences(page, language, changedTheme);
					expectMatchingControls(
						await capture(page, info, 'settings-theme-tapped')
					);

					const changedLanguage = language === 'he' ? 'en' : 'he';
					await select.selectOption({
						label: changedLanguage === 'he' ? 'עב' : 'en'
					});
					await expectPreferences(page, changedLanguage, changedTheme);
					await expectSettingsReady(page, changedLanguage);
					expectMatchingControls(
						await capture(page, info, 'settings-language-selected')
					);

					// Enter the controls through the actual tab order, in both LTR/RTL.
					await footer
						.locator(
							'a[href="https://github.com/selfint/degree-planner/issues/new/choose"]'
						)
						.focus();
					await page.keyboard.press('Tab');
					await expectVisibleFocus(toggle, toggle);
					expectMatchingControls(
						await capture(page, info, 'settings-theme-focus')
					);
					await page.keyboard.press('Tab');
					await expectVisibleFocus(select, select.locator('..'));
					expectMatchingControls(
						await capture(page, info, 'settings-language-focus')
					);

					// Open and operate the real platform select, never dispatch a
					// synthetic change event or replace it with a custom dropdown.
					await select.click();
					await page.keyboard.press(
						language === 'he' ? 'ArrowDown' : 'ArrowUp'
					);
					await page.keyboard.press('Enter');
					await page.keyboard.press('Escape');
					await expectPreferences(page, language, changedTheme);
					await expectSettingsReady(page, language);
					await expect(select).toBeFocused();
					await page.keyboard.press('Shift+Tab');
					await expectVisibleFocus(toggle, toggle);
					await page.keyboard.press('Space');
					await expectPreferences(page, language, theme);
					expectMatchingControls(
						await capture(page, info, 'settings-keyboard-restored')
					);

					// Init only seeds an empty guest context, so this checks actual
					// saved preferences rather than resetting them on every load.
					await select.selectOption({
						label: changedLanguage === 'he' ? 'עב' : 'en'
					});
					await toggle.tap();
					await expectPreferences(page, changedLanguage, changedTheme);
					await page.reload();
					await expectSettingsReady(page, changedLanguage);
					await expectPreferences(page, changedLanguage, changedTheme);
					expectMatchingControls(
						await capture(page, info, 'settings-reloaded')
					);
				});

				test('keeps populated settings composed through a real public-data refresh error and Retry', async ({
					page,
					refreshProxy
				}, info) => {
					const appOrigin = refreshProxy.origin;
					const sourceEvidence = {
						source: 'real production build through loopback proxy',
						upstreamOrigin: origin,
						proxyOrigin: appOrigin
					};
					await prepareGuest(page, language, theme, populatedGuest, appOrigin);
					await page.goto(`${appOrigin}/app/settings`);
					await expectSettingsReady(page, language);
					await expectPreferences(page, language, theme);
					await expectGuestSettings(page, language, true);
					await expectHealthyPwa(page, language);
					const savedPlan = await page.evaluate(() =>
						localStorage.getItem('userData')
					);
					expectMatchingControls(
						await capture(page, info, 'settings-populated', {
							fullPage: true,
							evidence: sourceEvidence
						})
					);

					// A cold catalogs failure can reject the settings await block. Warm the
					// real durable data first, then fail only its actual network refresh.
					// Successful JSON and browser APIs remain untouched; only HTTP 503 is
					// injected by the loopback server. No account data is involved.
					const failedRequests = refreshProxy.failedRequests;
					refreshProxy.failCourses = true;
					await page.reload();
					await expectSettingsReady(page, language);
					await expectGuestSettings(page, language, true);
					await expectPreferences(page, language, theme);
					const status = page.getByTestId('pwa-status');
					// Prove the real network fault before waiting on its UI consequence.
					await expect
						.poll(() => failedRequests.length, { timeout: 15_000 })
						.toBeGreaterThan(0);
					await expect
						.poll(() => page.evaluate(() => navigator.onLine))
						.toBe(true);
					await expect(status).toHaveAttribute('data-refresh-state', 'error', {
						timeout: 30_000
					});
					expect(
						failedRequests.length,
						'real public-data request received HTTP 503'
					).toBeGreaterThan(0);
					expect(
						failedRequests.every(({ url, status }) => {
							const request = new URL(url);
							return (
								status === 503 &&
								request.origin === appOrigin &&
								request.pathname === '/courseData.json'
							);
						})
					).toBe(true);
					const errorLink = status.getByRole('link', {
						name:
							language === 'he' ? 'שגיאה. הצגת פרטים' : 'Error. View details',
						exact: true
					});
					const retry = status.getByRole('button', {
						name: language === 'he' ? 'נסו שוב' : 'Retry',
						exact: true
					});
					await expect(errorLink).toBeVisible();
					await expect(errorLink).toHaveAttribute('href', '#offline-status');
					await expect(retry).toBeEnabled();
					await expect(page.getByTestId('pwa-refresh-error')).toHaveText(
						language === 'he'
							? 'רענון הנתונים נכשל. נתוני הקורסים השמורים עדיין זמינים.'
							: 'Refresh failed. Saved course data is still available.'
					);
					await expect(
						page.getByTestId('pwa-error-detail').first()
					).toContainText('/courseData.json');
					await expect(
						page.getByTestId('pwa-error-detail').first()
					).toContainText('(503)');
					// A retained Document handle is an identity sentinel, unlike WebKit's
					// performance.timeOrigin, which can differ between reads.
					const documentIdentity = await page.evaluateHandle(() => document);
					const documentRequests: string[] = [];
					let domContentLoadedEvents = 0;
					const onRequest = (request: Request) => {
						if (
							request.resourceType() === 'document' &&
							request.frame() === page.mainFrame()
						) {
							documentRequests.push(request.url());
						}
					};
					const onDomContentLoaded = () => {
						domContentLoadedEvents += 1;
					};
					page.on('request', onRequest);
					page.on('domcontentloaded', onDomContentLoaded);
					try {
						await errorLink.click();
						await expect(page).toHaveURL(
							`${appOrigin}/app/settings#offline-status`
						);
						expect(
							await page.evaluate(
								(originalDocument) => document === originalDocument,
								documentIdentity
							),
							'error details anchor preserves the original Document'
						).toBe(true);
						expect(
							documentRequests,
							'no main-document navigation request'
						).toEqual([]);
						expect(domContentLoadedEvents, 'no document reload event').toBe(0);

						expectMatchingControls(
							await capture(page, info, 'settings-refresh-error', {
								fullPage: true,
								evidence: {
									...sourceEvidence,
									failedPublicDataRequests: failedRequests
								}
							})
						);

						refreshProxy.failCourses = false;
						const responsesBeforeRetry = refreshProxy.courseResponses.length;
						await retry.click();
						await expect
							.poll(
								() =>
									refreshProxy.courseResponses
										.slice(responsesBeforeRetry)
										.some(
											({ status }) =>
												(status >= 200 && status < 300) || status === 304
										),
								{ timeout: 30_000 }
							)
							.toBe(true);
						const response = refreshProxy.courseResponses
							.slice(responsesBeforeRetry)
							.find(
								({ status }) =>
									(status >= 200 && status < 300) || status === 304
							)!;
						await expectHealthyPwa(page, language);
						await expectGuestSettings(page, language, true);
						await expectPreferences(page, language, theme);
						expect(
							await page.evaluate(
								(originalDocument) => document === originalDocument,
								documentIdentity
							),
							'Retry recovers in the original Document'
						).toBe(true);
						expect(
							documentRequests,
							'no main-document request through Retry'
						).toEqual([]);
						expect(
							domContentLoadedEvents,
							'no reload event through Retry'
						).toBe(0);
						expect(
							await page.evaluate(() => localStorage.getItem('userData')),
							'guest plan survives refresh failure and recovery'
						).toBe(savedPlan);
						expectMatchingControls(
							await capture(page, info, 'settings-retry-recovered', {
								fullPage: true,
								evidence: {
									...sourceEvidence,
									failedPublicDataRequests: failedRequests,
									refreshedUrl: response.url,
									status: response.status
								}
							})
						);
					} finally {
						page.off('request', onRequest);
						page.off('domcontentloaded', onDomContentLoaded);
						await documentIdentity.dispose();
					}
				});
			});
		}
	}
}

test.describe('normal landing footer controls', () => {
	test.use({
		viewport: { width: 390, height: 664 },
		isMobile: true,
		hasTouch: true
	});
	test('retain equal outer sizing outside the compact console', async ({
		page
	}, info) => {
		await prepareGuest(page, 'en', 'dark');
		await page.goto(origin);
		await expect(page.locator('footer .theme-toggle')).toBeEnabled();
		await expectPreferences(page, 'en', 'dark');
		expectMatchingControls(
			await capture(page, info, 'landing-normal-footer'),
			false
		);
		await expect(
			page.locator('footer').getByTestId('pwa-footer-row')
		).toHaveCount(0);
	});
});
