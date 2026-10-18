import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { expectSearchFiltersVisible } from './helpers/searchFilters';

const origin = new URL(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
).origin;
// Use the production app and canonical data, never replacement faculty options.
const courses = Object.values(
	JSON.parse(
		readFileSync(new URL('../static/courseData.json', import.meta.url), 'utf8')
	)
) as { code: string; faculty?: string; points?: number; median?: number }[];
const faculties = [
	'הפקולטה להנדסת ביוטכנולוגיה ומזון',
	'המחלקה ללימודים הומניסטיים ואמנות'
] as const;
// A short, real option gives the same native widget's one-line height on each
// engine. WebKit's intrinsic native select is taller than a number input.
const singleLineFaculty = 'הנדסה ימית';
const maxPoints =
	Math.ceil(Math.max(...courses.map((course) => course.points ?? 0)) * 2) / 2;

// Retain the actual loading sequence when a native-control capture fails. A
// missing shared stylesheet can move the control outside the viewport even
// though the search route's own styles and hydration are already ready.
test.use({ trace: 'retain-on-failure' });

type AssetEvent = {
	phase: 'request' | 'response' | 'failed';
	at: number;
	url: string;
	type: string;
	status?: number;
	contentType?: string;
	error?: string;
};
const assetEvents = new WeakMap<Page, AssetEvent[]>();

test.beforeEach(async ({ page }) => {
	const events: AssetEvent[] = [];
	assetEvents.set(page, events);
	const record = (
		request: import('@playwright/test').Request,
		data: Omit<AssetEvent, 'at' | 'url' | 'type'>
	) => {
		if (!['stylesheet', 'script'].includes(request.resourceType())) return;
		const url = new URL(request.url());
		if (url.origin !== origin) return;
		events.push({
			...data,
			at: Date.now(),
			url: `${url.origin}${url.pathname}`,
			type: request.resourceType()
		});
	};
	page.on('request', (request) => record(request, { phase: 'request' }));
	page.on('response', (response) =>
		record(response.request(), {
			phase: 'response',
			status: response.status(),
			contentType: response.headers()['content-type']
		})
	);
	page.on('requestfailed', (request) =>
		record(request, {
			phase: 'failed',
			error: request.failure()?.errorText
		})
	);
});

async function stylesheetState(page: Page) {
	return page.evaluate(() => {
		const header = document.querySelector('header.title-bar');
		const logo = header?.querySelector('.brand-logo');
		const box = (element: Element | null | undefined) => {
			if (!element) return null;
			const { x, y, width, height } = element.getBoundingClientRect();
			return { x, y, width, height };
		};
		return {
			readyState: document.readyState,
			header: box(header),
			logo: box(logo),
			headerDisplay: header ? getComputedStyle(header).display : null,
			headerClass: header?.className,
			stylesheets: [
				...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
			].map((link) => {
				let rules: number | null = null;
				let rulesError: string | null = null;
				try {
					rules = link.sheet?.cssRules.length ?? null;
				} catch (error) {
					rulesError = String(error);
				}
				return {
					href: link.href,
					media: link.media,
					disabled: link.disabled,
					loaded: Boolean(link.sheet),
					rules,
					rulesError
				};
			})
		};
	});
}

test.afterEach(async ({ page }, info) => {
	const events = assetEvents.get(page) ?? [];
	const path = info.outputPath('asset-loading.json');
	writeFileSync(
		path,
		JSON.stringify(
			{ events, final: page.isClosed() ? null : await stylesheetState(page) },
			null,
			2
		)
	);
	await info.attach('asset-loading', { path, contentType: 'application/json' });
	expect
		.soft(
			events.filter(
				(event) => event.phase === 'failed' || (event.status ?? 0) >= 400
			),
			'the real application scripts and stylesheets load without asset errors'
		)
		.toEqual([]);
});

async function expectState(page: Page, faculty: string, pointsMax = maxPoints) {
	const params: Record<string, string> = { q: '0', faculty };
	if (pointsMax < maxPoints) params.pointsMax = String(pointsMax);
	await expect
		.poll(() => Object.fromEntries(new URL(page.url()).searchParams))
		.toEqual(params);
	await expect(page.locator('#search-faculty')).toHaveValue(faculty);
	await expect(page.locator('#search-faculty option:checked')).toHaveText(
		faculty
	);
	await expect(page.locator('#search-points-max-input')).toHaveValue(
		pointsMax.toFixed(1)
	);
	const expected = courses
		.filter(
			(course) =>
				course.code.includes('0') &&
				course.faculty === faculty &&
				(pointsMax === maxPoints ||
					(course.points !== undefined && course.points <= pointsMax))
		)
		.sort((a, b) => (b.median ?? 0) - (a.median ?? 0));
	expect(
		expected.length,
		'the canonical snapshot contains these real faculty courses'
	).toBeGreaterThan(0);
	await expect
		.poll(() =>
			page
				.locator('.search-results > li')
				.evaluateAll((items) => items.map((item) => item.id))
		)
		.toEqual(expected.map((course) => course.code));
	await expect(page.locator('.search-count')).toHaveText(
		new RegExp(`^${expected.length}\\s`)
	);
	await expectSearchFiltersVisible(page);
}

async function chooseNativeFaculty(page: Page, faculty: string) {
	const select = page.locator('#search-faculty');
	const target = await select.evaluate(
		(element: HTMLSelectElement, value) =>
			[...element.options].findIndex((option) => option.value === value),
		faculty
	);
	expect(target).toBeGreaterThanOrEqual(0);
	// Opening the actual picker must retain a number draft committed by its blur.
	// Do not use selectOption, synthetic changes, or a custom replacement picker.
	await select.click();
	const current = await select.evaluate(
		(element: HTMLSelectElement) => element.selectedIndex
	);
	for (let index = 0; index < Math.abs(target - current); index++)
		await page.keyboard.press(target >= current ? 'ArrowDown' : 'ArrowUp');
	await page.keyboard.press('Enter');
}

async function captureClosedControl(
	page: Page,
	info: TestInfo,
	stage: string,
	singleLineNative: { faculty: string; height: number }
) {
	const select = page.locator('#search-faculty');
	const requestedViewport = page.viewportSize()!;
	// Normalize keyboard focus in both captures. The next control is a range,
	// with no blinking caret; all nearby filter values remain unchanged.
	await page.locator('.filter-available input').focus();
	await page.keyboard.press('Tab');
	await expect(select).toBeFocused();
	const focus = await select.evaluate((element) => {
		const rings = [];
		for (
			let node: Element | null = element;
			node && !node.matches('fieldset');
			node = node.parentElement
		) {
			const style = getComputedStyle(node);
			rings.push({
				tag: node.tagName,
				outlineStyle: style.outlineStyle,
				outlineWidth: parseFloat(style.outlineWidth)
			});
		}
		return { visible: element.matches(':focus-visible'), rings };
	});
	expect
		.soft(focus.visible, 'native select retains keyboard-visible focus')
		.toBe(true);
	expect
		.soft(
			focus.rings.some(
				(ring) => ring.outlineStyle !== 'none' && ring.outlineWidth >= 2
			),
			'the native control or its containing frame draws the keyboard focus ring'
		)
		.toBe(true);
	await page.keyboard.press('Tab');
	await page.evaluate(async () => {
		await document.fonts.ready;
		window.scrollTo(0, 0);
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	});
	const layout = await select.evaluate((element: HTMLSelectElement) => {
		const box = (node: Element) => {
			const { left, right, top, bottom, width, height } =
				node.getBoundingClientRect();
			return { left, right, top, bottom, width, height };
		};
		const field = element.closest('.filter-field')!;
		const grid = element.closest('.filter-grid')!;
		const style = getComputedStyle(element);
		return {
			url: location.href,
			viewport: { width: innerWidth, height: innerHeight },
			direction: getComputedStyle(grid).direction,
			documentWidth: document.documentElement.scrollWidth,
			bodyWidth: document.body.scrollWidth,
			scrollX,
			scrollY,
			grid: {
				...box(grid),
				columns: getComputedStyle(grid).gridTemplateColumns
			},
			field: box(field),
			select: {
				...box(element),
				value: element.value,
				selectedText: element.selectedOptions[0].text,
				labelIds: [...(element.labels ?? [])].map((label) => label.htmlFor),
				fontSize: parseFloat(style.fontSize),
				lineHeight: style.lineHeight,
				minimumHeight: parseFloat(style.minHeight),
				verticalInsets: [
					'paddingTop',
					'paddingBottom',
					'borderTopWidth',
					'borderBottomWidth'
				].reduce(
					(total, property) =>
						total +
						parseFloat(style[property as keyof CSSStyleDeclaration] as string),
					0
				),
				overflowX: style.overflowX,
				scrollWidth: element.scrollWidth,
				clientWidth: element.clientWidth
			},
			controls: [...grid.querySelectorAll('input, select, button')].map(
				(control) => ({
					...box(control),
					id: control.id,
					type: control.getAttribute('type'),
					tag: control.tagName,
					fontSize: parseFloat(getComputedStyle(control).fontSize)
				})
			)
		};
	});
	const layoutPath = info.outputPath(`${stage}-layout.json`);
	const assets = await stylesheetState(page);
	writeFileSync(
		layoutPath,
		JSON.stringify(
			{
				project: info.project.name,
				requestedViewport,
				singleLineNative,
				focus,
				assets,
				...layout
			},
			null,
			2
		)
	);
	await info.attach(`${stage}-layout`, {
		path: layoutPath,
		contentType: 'application/json'
	});
	const viewportPath = info.outputPath(`${stage}-viewport.png`);
	await page.screenshot({ path: viewportPath });
	await info.attach(`${stage}-viewport`, {
		path: viewportPath,
		contentType: 'image/png'
	});
	// Quantitative geometry is the primary overflow check. Native selected text
	// may truncate inside the box; neither the control nor the document may grow.
	expect
		.soft(
			layout.viewport.width,
			`${stage}: mobile layout keeps the requested viewport`
		)
		.toBe(requestedViewport.width);
	expect
		.soft(layout.documentWidth, `${stage}: document fits viewport`)
		.toBeLessThanOrEqual(requestedViewport.width);
	expect
		.soft(layout.bodyWidth, `${stage}: body fits viewport`)
		.toBeLessThanOrEqual(requestedViewport.width);
	expect
		.soft(Math.abs(layout.scrollX), `${stage}: no sideways page scroll`)
		.toBeLessThanOrEqual(1);
	expect
		.soft(layout.select.left, `${stage}: select stays inside its field`)
		.toBeGreaterThanOrEqual(layout.field.left - 1);
	expect
		.soft(layout.select.right, `${stage}: select stays inside its field`)
		.toBeLessThanOrEqual(layout.field.right + 1);
	expect
		.soft(layout.select.height, `${stage}: closed native value stays one line`)
		// Preserve this browser's actual native height; a long option must not
		// wrap into extra lines or increase it relative to a short real option.
		.toBeLessThanOrEqual(singleLineNative.height + 1);
	expect(layout.select.labelIds).toContain('search-faculty');
	for (const control of layout.controls) {
		expect
			.soft(control.left, `${stage}: ${control.id || control.tag} left edge`)
			.toBeGreaterThanOrEqual(layout.grid.left - 1);
		expect
			.soft(control.right, `${stage}: ${control.id || control.tag} right edge`)
			.toBeLessThanOrEqual(layout.grid.right + 1);
		expect.soft(control.left).toBeGreaterThanOrEqual(-1);
		expect.soft(control.right).toBeLessThanOrEqual(requestedViewport.width + 1);
		if (control.tag === 'SELECT' || control.type === 'number')
			expect
				.soft(control.fontSize, 'keep native mobile controls at least 16px')
				.toBeGreaterThanOrEqual(16);
	}
	// Native WebKit can paint selected glyphs outside its own reported bounds.
	// Compare only the immediate horizontal row outside the control, never the
	// changed results/count. This is a same-test comparison, not a pixel golden.
	const row = {
		y: Math.floor(layout.select.top + layout.scrollY),
		height: Math.ceil(layout.select.height)
	};
	const leftEdge = Math.max(
		0,
		Math.min(requestedViewport.width, Math.floor(layout.select.left))
	);
	const rightEdge = Math.max(0, Math.ceil(layout.select.right));
	const strips = [
		{
			side: 'left',
			x: Math.max(0, leftEdge - 32),
			width: Math.min(32, leftEdge)
		},
		{
			side: 'right',
			x: rightEdge,
			width: Math.min(32, Math.max(0, requestedViewport.width - rightEdge))
		}
	];
	const captures = [];
	for (const { side, x, width } of strips) {
		if (!width) continue;
		const clip = { x, width, ...row };
		const path = info.outputPath(`${stage}-outside-${side}.png`);
		const pixels = await page.screenshot({ clip, path });
		await info.attach(`${stage}-outside-${side}`, {
			path,
			contentType: 'image/png'
		});
		captures.push({ side, clip, pixels });
	}
	return captures;
}

for (const language of ['en', 'he']) {
	// 424 and 640 exercise newly split grid tracks, narrower than the single
	// faculty column at 320/390 despite their larger overall viewports.
	for (const width of [320, 390, 424, 640]) {
		test.describe(`native faculty width ${language} ${width}px`, () => {
			test.use({
				viewport: { width, height: 844 },
				isMobile: true,
				hasTouch: true
			});
			test('contains real long options while retaining native focus, URL and drafts', async ({
				page
			}, info) => {
				test.setTimeout(90_000);
				await page.addInitScript(
					(lang) => localStorage.setItem('lang', lang),
					language
				);
				await page.goto(
					`${origin}/app/search?${new URLSearchParams({ q: '0', faculty: singleLineFaculty })}`
				);
				const select = page.locator('#search-faculty');
				await expect(select).toBeVisible({ timeout: 30_000 });
				await expectState(page, singleLineFaculty);
				await page.evaluate(() => document.fonts.ready);
				const singleLineNative = {
					faculty: singleLineFaculty,
					height: await select.evaluate(
						(element) => element.getBoundingClientRect().height
					)
				};
				expect(singleLineNative.height).toBeGreaterThan(0);
				await expect(select).toHaveAccessibleName(
					language === 'he' ? 'פקולטה' : 'Faculty'
				);
				for (const faculty of faculties)
					await expect(
						select.locator('option').filter({ hasText: faculty })
					).toHaveText(faculty);
				await page.locator('label[for="search-faculty"]').click();
				await page.keyboard.press('Escape');
				await expect(
					select,
					'the visible label focuses the real select'
				).toBeFocused();

				await captureClosedControl(
					page,
					info,
					'short-native-baseline',
					singleLineNative
				);
				await chooseNativeFaculty(page, faculties[1]);
				await expectState(page, faculties[1]);
				const humanities = await captureClosedControl(
					page,
					info,
					'humanities',
					singleLineNative
				);
				await chooseNativeFaculty(page, faculties[0]);
				await expectState(page, faculties[0]);
				const biotech = await captureClosedControl(
					page,
					info,
					'biotech',
					singleLineNative
				);
				expect
					.soft(biotech.map((capture) => capture.side))
					.toEqual(humanities.map((capture) => capture.side));
				for (let index = 0; index < humanities.length; index++) {
					expect
						.soft(
							biotech[index]?.clip,
							'stable comparison region beside the native select'
						)
						.toEqual(humanities[index].clip);
					expect
						.soft(
							biotech[index]?.pixels.equals(humanities[index].pixels),
							`changing only faculty text must not paint outside the closed control (${humanities[index].side})`
						)
						.toBe(true);
				}

				await page.locator('#search-points-max-input').fill('5.3');
				await expect(page.locator('#search-points-max-input')).toHaveValue(
					'5.3'
				);
				expect(
					new URL(page.url()).searchParams.has('pointsMax'),
					'unfinished numeric draft stays out of the URL'
				).toBe(false);
				await chooseNativeFaculty(page, faculties[1]);
				await expectState(page, faculties[1], 5.3);
				await captureClosedControl(
					page,
					info,
					'committed-draft',
					singleLineNative
				);
				await page.reload();
				await expect(select).toBeVisible({ timeout: 30_000 });
				await expectState(page, faculties[1], 5.3);
				await captureClosedControl(page, info, 'reloaded', singleLineNative);
			});
		});
	}
}
