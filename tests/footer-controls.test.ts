import { writeFileSync } from 'node:fs';
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
type Theme = 'light' | 'dark';
const guest = {
	degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
	semesters: [[], [], []],
	currentSemester: 0,
	exemptions: [],
	wishlist: []
};

async function prepareGuest(page: Page, language: Language, theme: Theme) {
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
		{ language, theme, guest }
	);
	// A fresh context stays a guest; external auth/analytics requests are blocked.
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
	await expect(page.locator('footer .theme-toggle')).toBeEnabled();
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
		const toggle = footer.querySelector<HTMLButtonElement>('.theme-toggle')!;
		const select = footer.querySelector<HTMLSelectElement>('select')!;
		const selectStyle = getComputedStyle(select);
		const selectedText = select.selectedOptions[0].text;
		// Native option glyph rectangles are not exposed consistently by Chromium
		// and WebKit. Record the real control's alignment and text-fit metrics;
		// the persisted viewport screenshot also shows its native arrow/rendering.
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d')!;
		context.font = selectStyle.font;
		const text = context.measureText(selectedText);
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
		return {
			url: location.href,
			viewport: { width: innerWidth, height: innerHeight },
			scrollX,
			scrollY,
			rootSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
			theme: document.documentElement.dataset.theme,
			direction: getComputedStyle(footer).direction,
			documentOverflow: document.documentElement.scrollWidth - innerWidth,
			footer: {
				...box(footer),
				overflow: footer.scrollWidth - footer.clientWidth
			},
			firstRow: box(footer.firstElementChild!),
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
				paddingLeft: parseFloat(selectStyle.paddingLeft),
				paddingRight: parseFloat(selectStyle.paddingRight),
				paddingTop: parseFloat(selectStyle.paddingTop),
				paddingBottom: parseFloat(selectStyle.paddingBottom),
				selectedText,
				options: [...select.options].map((option) => option.text),
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
			pwaRows: footer.querySelectorAll('[data-testid="pwa-footer-row"]').length,
			separators
		};
	});
}

type Geometry = Awaited<ReturnType<typeof measureFooter>>;

function expectMatchingControls(geometry: Geometry, compact = true) {
	const { toggle, language, rootSize, viewport } = geometry;
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
	expect(language.appearance, 'retain the platform picker').not.toBe('none');
	expect(language.options).toEqual(['en', 'עב']);
	expect(language.textAlign).toBe('center');
	expect(language.textAlignLast).toBe('center');
	expect(language.paddingLeft).toBe(language.paddingRight);
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
	expect(
		geometry.documentOverflow,
		'no horizontal page overflow'
	).toBeLessThanOrEqual(1);
	expect(Math.abs(geometry.scrollX)).toBeLessThanOrEqual(1);
	expect(geometry.separators, 'one footer separator').toEqual([
		{ element: 'footer', edge: 'top', width: 1 }
	]);
	if (compact) {
		expect(geometry.pwaRows).toBe(1);
		expect(
			geometry.pwa,
			'PWA row stays below the preference row'
		).not.toBeNull();
		expect(geometry.pwa!.top).toBeGreaterThanOrEqual(geometry.firstRow.bottom);
		expect(geometry.pwa!.top).toBeGreaterThanOrEqual(0);
		expect(geometry.pwa!.bottom).toBeLessThanOrEqual(viewport.height);
		expect(geometry.pwa!.left).toBeGreaterThanOrEqual(0);
		expect(geometry.pwa!.right).toBeLessThanOrEqual(viewport.width);
	}
}

async function capture(page: Page, info: TestInfo, name: string) {
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
	const geometryPath = info.outputPath(`${name}-geometry.json`);
	writeFileSync(geometryPath, JSON.stringify(geometry, null, 2));
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
					const footer = page.locator('footer');
					const toggle = footer.locator('.theme-toggle');
					const select = footer.locator('select');
					await expect(footer).toHaveCount(1);
					await expect(footer.getByTestId('pwa-footer-row')).toHaveCount(1);
					await expect(footer.getByTestId('pwa-install-help')).toHaveAttribute(
						'href',
						'/#install-title'
					);
					await expect(
						page.locator('header.title-bar').getByTestId('pwa-status')
					).toHaveCount(0);
					await expect(
						footer.locator('hr, [role="separator"], [role="listbox"]')
					).toHaveCount(0);
					expectMatchingControls(await capture(page, info, 'settings-initial'));

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
