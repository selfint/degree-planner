import { expect, test, type Locator, type Page } from '@playwright/test';
import { pwaMessages } from '../../src/lib/pwa/messages';
import { coverage } from '../coverage';

const controls = 'components-button--primary';
const storyUrl = (id: string) =>
	`/storybook/iframe.html?id=${id}&viewMode=story`;

async function expectCompactAction(button: Locator) {
	await expect(button).toHaveCSS('white-space', 'nowrap');
	const box = await button.boundingBox();
	expect(box!.height).toBeGreaterThanOrEqual(35.5);
	expect(box!.height).toBeLessThanOrEqual(36.5);
}

async function withRootFontSize(
	page: Page,
	pixels: number,
	assertions: () => Promise<void>
) {
	const root = page.locator('html');
	const previousStyle = await root.getAttribute('style');
	try {
		await root.evaluate((element, size) => {
			element.style.fontSize = `${size}px`;
		}, pixels);
		await expect(root).toHaveCSS('font-size', `${pixels}px`);
		await assertions();
	} finally {
		// Restore even after a failed assertion; no scale leaks into the next case.
		await root.evaluate((element, style) => {
			if (style === null) element.removeAttribute('style');
			else element.setAttribute('style', style);
		}, previousStyle);
	}
}

async function expectScaledIcon(
	icon: Locator,
	control: Locator,
	pixels: number,
	centerHorizontally = false
) {
	await expect(icon).toBeVisible();
	await expect(icon).toHaveCSS('width', `${pixels}px`);
	await expect(icon).toHaveCSS('height', `${pixels}px`);
	const [bounds, parent] = await Promise.all([
		icon.boundingBox(),
		control.boundingBox()
	]);
	expect(bounds!.width).toBeCloseTo(pixels, 1);
	expect(bounds!.height).toBeCloseTo(pixels, 1);
	expect(bounds!.x).toBeGreaterThanOrEqual(parent!.x - 0.5);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
		parent!.x + parent!.width + 0.5
	);
	expect(bounds!.y).toBeGreaterThanOrEqual(parent!.y - 0.5);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
		parent!.y + parent!.height + 0.5
	);
	expect(bounds!.y + bounds!.height / 2).toBeCloseTo(
		parent!.y + parent!.height / 2,
		1
	);
	if (centerHorizontally)
		expect(bounds!.x + bounds!.width / 2).toBeCloseTo(
			parent!.x + parent!.width / 2,
			1
		);
}

async function expectSingleRenderedLine(text: Locator) {
	await expect(text).toBeVisible();
	const geometry = await text.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		const parent = element.parentElement!.getBoundingClientRect();
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		const rects: {
			left: number;
			right: number;
			top: number;
			bottom: number;
		}[] = [];
		while (walker.nextNode()) {
			if (!walker.currentNode.textContent?.trim()) continue;
			const range = document.createRange();
			range.selectNodeContents(walker.currentNode);
			for (const rect of range.getClientRects()) {
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
			lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
			fits: rects.every(
				(rect) =>
					rect.left >= Math.max(bounds.left, parent.left) - 0.5 &&
					rect.right <= Math.min(bounds.right, parent.right) + 0.5 &&
					rect.top >= bounds.top - 0.5 &&
					rect.bottom <= bounds.bottom + 0.5
			)
		};
	});
	expect(
		geometry.lines,
		'the entire text, including nested author link, stays on one rendered line'
	).toBe(1);
	expect(
		geometry.fits,
		'text fits its own box and the available parent width'
	).toBe(true);
}

async function expectFooterComposition(page: Page) {
	const footer = page.locator('footer');
	await expectSingleRenderedLine(footer.locator('.footer-credit'));
	const layout = await footer.evaluate((element) => {
		const box = (selector: string) => {
			const { left, right, top, bottom, height } = element
				.querySelector(selector)!
				.getBoundingClientRect();
			return { left, right, top, bottom, height, centerY: top + height / 2 };
		};
		return {
			direction: getComputedStyle(element).direction,
			main: box('.footer-main'),
			links: box('.footer-links'),
			credit: box('.footer-credit'),
			report: box('.footer-report'),
			preferences: box('.preference-controls'),
			overflow: element.scrollWidth - element.clientWidth
		};
	});
	await expect(footer.locator('.footer-main')).toHaveCSS('display', 'grid');
	expect(layout.report.top).toBeGreaterThanOrEqual(layout.credit.bottom - 0.5);
	expect(layout.preferences.centerY).toBeCloseTo(layout.links.centerY, 1);
	expect(layout.main.height).toBeCloseTo(
		Math.max(layout.links.height, layout.preferences.height),
		1
	);
	const start = layout.direction === 'rtl' ? 'right' : 'left';
	const end = layout.direction === 'rtl' ? 'left' : 'right';
	for (const item of [layout.links, layout.credit, layout.report])
		expect(item[start]).toBeCloseTo(layout.main[start], 1);
	expect(layout.preferences[end]).toBeCloseTo(layout.main[end], 1);
	expect(
		layout.direction === 'rtl'
			? layout.links.left - layout.preferences.right
			: layout.preferences.left - layout.links.right
	).toBeGreaterThanOrEqual(11.5);
	for (const item of [layout.credit, layout.report, layout.preferences]) {
		expect(item.left).toBeGreaterThanOrEqual(layout.main.left - 0.5);
		expect(item.right).toBeLessThanOrEqual(layout.main.right + 0.5);
	}
	expect(layout.overflow).toBe(0);
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
	).toBe(0);
}

async function expectFooterPreferenceGeometry(page: Page, compact: boolean) {
	await expectFooterComposition(page);
	const controls = page.locator('footer .preference-controls');
	const toggle = controls.getByRole('button');
	const language = controls.getByRole('combobox');
	await expect(toggle).toBeEnabled();
	const [button, select, icon] = await Promise.all([
		toggle.boundingBox(),
		language.boundingBox(),
		toggle.locator('svg').boundingBox()
	]);
	for (const bounds of [button!, select!]) {
		expect(bounds.width).toBeCloseTo(48, 1);
		expect(bounds.height).toBeCloseTo(compact ? 36 : 44, 1);
	}
	expect(button!.y).toBeCloseTo(select!.y, 1);
	expect(icon!.x + icon!.width / 2).toBeCloseTo(
		button!.x + button!.width / 2,
		1
	);
	expect(icon!.y + icon!.height / 2).toBeCloseTo(
		button!.y + button!.height / 2,
		1
	);
	// Native option text is painted inside the select's padded content box.
	// One decorative chevron replaces platform arrows without replacing the picker.
	await expect(language).toHaveCSS('text-align', 'center');
	await expect(language).toHaveCSS('text-align-last', 'center');
	await expect(language).toHaveCSS('appearance', 'none');
	const chevron = controls.locator('.language-chevron');
	await expect(chevron).toHaveCount(1);
	await expect(chevron).toHaveAttribute('aria-hidden', 'true');
	await expect(chevron).toHaveAttribute('focusable', 'false');
	await expect(chevron).toHaveCSS('pointer-events', 'none');
	const valueArea = await language.evaluate((element) => {
		const select = element as HTMLSelectElement;
		const style = getComputedStyle(select);
		const bounds = select.getBoundingClientRect();
		const chevron = select
			.closest('label')!
			.querySelector('.language-chevron')!;
		const icon = chevron.getBoundingClientRect();
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d')!;
		context.font = style.font;
		const text = context.measureText(select.selectedOptions[0].text);
		const left =
			bounds.left + select.clientLeft + parseFloat(style.paddingLeft);
		const width =
			select.clientWidth -
			parseFloat(style.paddingLeft) -
			parseFloat(style.paddingRight);
		return {
			isNative: select instanceof HTMLSelectElement,
			type: select.type,
			direction: style.direction,
			inlineStart: style.paddingInlineStart,
			inlineEnd: style.paddingInlineEnd,
			blockStart: style.paddingBlockStart,
			blockEnd: style.paddingBlockEnd,
			textLeft: left + (width - text.width) / 2,
			textRight: left + (width + text.width) / 2,
			textWidth: text.width,
			contentWidth: width,
			icon: {
				left: icon.left,
				right: icon.right,
				top: icon.top,
				width: icon.width,
				height: icon.height
			},
			overflow: select.scrollWidth - select.clientWidth
		};
	});
	expect(valueArea.isNative).toBe(true);
	expect(valueArea.type).toBe('select-one');
	expect(valueArea.inlineStart).toBe('4px');
	expect(valueArea.inlineEnd).toBe('16px');
	expect(valueArea.blockStart).toBe(valueArea.blockEnd);
	expect(valueArea.textWidth).toBeGreaterThan(0);
	expect(valueArea.textWidth).toBeLessThanOrEqual(valueArea.contentWidth);
	expect(valueArea.icon.width).toBeCloseTo(10, 1);
	expect(valueArea.icon.height).toBeCloseTo(10, 1);
	expect(valueArea.icon.top + valueArea.icon.height / 2).toBeCloseTo(
		select!.y + select!.height / 2,
		1
	);
	if (valueArea.direction === 'rtl') {
		expect(valueArea.icon.left - select!.x).toBeCloseTo(6, 1);
		expect(valueArea.textLeft).toBeGreaterThan(valueArea.icon.right);
	} else {
		expect(select!.x + select!.width - valueArea.icon.right).toBeCloseTo(6, 1);
		expect(valueArea.textRight).toBeLessThan(valueArea.icon.left);
	}
	expect(valueArea.overflow).toBeLessThanOrEqual(1);
}

async function expectNaturalRowHeight(row: Locator) {
	const cards = await row.locator('.course-card').evaluateAll((elements) =>
		elements.map((element) => {
			const bounds = element.getBoundingClientRect();
			// The card shell stretches; its real contents retain their natural height.
			const contents = element.querySelector(':scope > .course-width')!;
			const natural = contents.getBoundingClientRect();
			return {
				top: bounds.top,
				bottom: bounds.bottom,
				height: bounds.height,
				naturalHeight: natural.height,
				contentTop: natural.top,
				contentBottom: natural.bottom
			};
		})
	);
	expect(cards.length).toBeGreaterThan(0);
	const tallest = Math.max(...cards.map((card) => card.naturalHeight));
	for (const card of cards) {
		expect(card.top).toBeCloseTo(cards[0].top, 1);
		expect(card.bottom).toBeCloseTo(cards[0].bottom, 1);
		expect(card.height).toBeCloseTo(tallest, 1);
		expect(card.contentTop).toBeGreaterThanOrEqual(card.top - 0.5);
		expect(card.contentBottom).toBeLessThanOrEqual(card.bottom + 0.5);
	}
	return tallest - Math.min(...cards.map((card) => card.naturalHeight));
}

async function expectPwaFooter(page: Page) {
	await expectFooterComposition(page);
	const footer = page.locator('footer');
	const row = footer.getByTestId('pwa-footer-row');
	await expect(row).toBeAttached();
	await expect(footer).toHaveCSS('border-top-width', '1px');
	await expect(row).toHaveCSS('border-top-width', '0px');
	await expect(row.getByTestId('pwa-status')).toHaveCount(1);
	const controls = await footer.locator(':scope > div').first().boundingBox();
	const bounds = await row.evaluate((element) => {
		const { x, y, width, height } = element.getBoundingClientRect();
		return { x, y, width, height };
	});
	expect(bounds!.y).toBeGreaterThanOrEqual(controls!.y + controls!.height);
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
		page.viewportSize()!.width
	);
	await expect(page.getByTestId('pwa-install-help')).toHaveCount(0);
	await expect(page.getByTestId('pwa-update-link')).toHaveCount(0);
	await expect(footer.getByTestId('pwa-update')).toHaveCount(0);
	// Footer groups may wrap; each action and readiness label stays complete.
	const labels = await row.locator('.pwa-footer-controls').evaluate((el) =>
		Array.from(
			el.querySelectorAll('a, button, .readiness:not(.sr-only)'),
			(child) => {
				const rect = child.getBoundingClientRect();
				return {
					left: rect.left,
					right: rect.right,
					overflow: child.scrollWidth - child.clientWidth
				};
			}
		)
	);
	for (const label of labels) {
		expect(label.left).toBeGreaterThanOrEqual(0);
		expect(label.right).toBeLessThanOrEqual(page.viewportSize()!.width);
		expect(label.overflow).toBeLessThanOrEqual(1);
	}
}

async function expectRailReadingEdge(
	rail: Locator,
	items: string,
	direction: string
) {
	await expect
		.poll(() =>
			rail.evaluate(
				(el, { items, direction }) => {
					const bounds = el.getBoundingClientRect();
					const first = el.querySelector(items)!.getBoundingClientRect();
					const start =
						direction === 'rtl' ? el.scrollWidth - el.clientWidth : 0;
					return {
						atReadingEdge: Math.abs(el.scrollLeft - start) <= 1,
						firstFullyVisible:
							first.left >= bounds.left - 0.5 &&
							first.right <= bounds.right + 0.5
					};
				},
				{ items, direction }
			)
		)
		.toEqual({ atReadingEdge: true, firstFullyVisible: true });
}

async function expectInlineCatalogMetrics(
	root: Locator,
	language: 'en' | 'he'
) {
	const pageTitle = root.locator(':scope > h1');
	await expect(pageTitle).toHaveText(language === 'he' ? 'קטלוג' : 'Catalog');
	await expect(pageTitle).toHaveClass(/\bsr-only\b/);
	await expect(pageTitle).toHaveCSS('position', 'absolute');
	await expect(root.locator(':scope > header')).toHaveCount(0);
	await expect(root.locator('.catalog-summary h2')).toBeVisible();
	const titleSpace = await root.evaluate((page) => {
		const summary = page.querySelector('.catalog-summary')!;
		return (
			summary.getBoundingClientRect().top -
			page.getBoundingClientRect().top -
			parseFloat(getComputedStyle(page).paddingTop)
		);
	});
	expect(
		Math.abs(titleSpace),
		'no empty visible page-heading row'
	).toBeLessThanOrEqual(1);
	await root.evaluate(async () => {
		await document.fonts.ready;
	});
	const rows = await root.locator('.catalog-metric').evaluateAll((metrics) => {
		const box = (element: Element) => {
			const { left, right, top, bottom } = element.getBoundingClientRect();
			return { left, right, top, bottom };
		};
		return metrics.map((metric) => {
			const label = metric.querySelector('.catalog-metric-label')!;
			const values = metric.querySelector('.catalog-values')!;
			const text = [label, ...values.querySelectorAll('dt, dd')].map(
				(element) => {
					const style = getComputedStyle(element);
					const bounds = box(element);
					const range = document.createRange();
					range.selectNodeContents(element);
					const rects = [...range.getClientRects()].filter(
						(rect) => rect.width > 0
					);
					// A zero-size inline probe exposes the actual text baseline without
					// guessing from different 12px/13px glyph or line-box heights.
					const probe = document.createElement('span');
					probe.style.cssText =
						'display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline';
					element.append(probe);
					const baseline = probe.getBoundingClientRect().top;
					probe.remove();
					return {
						...bounds,
						text: element.textContent!.trim(),
						tag: element.tagName,
						baseline,
						fontSize: style.fontSize,
						whiteSpace: style.whiteSpace,
						overflowX: style.overflowX,
						visibility: style.visibility,
						lineClamp: style.webkitLineClamp,
						lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
						textFits: rects.every(
							(rect) =>
								rect.left >= bounds.left - 0.5 &&
								rect.right <= bounds.right + 0.5
						),
						overflow: element.scrollWidth - element.clientWidth
					};
				}
			);
			return {
				...box(metric),
				category: !metric.closest('.catalog-summary'),
				direction: getComputedStyle(metric).direction,
				values: box(values),
				valuesOverflow: values.scrollWidth - values.clientWidth,
				groups: [...values.children].map(box),
				text,
				viewport: innerWidth
			};
		});
	});
	expect(rows.length).toBeGreaterThan(2);
	const labels = language === 'he' ? ['קורסים', 'נקודות'] : ['Count', 'Points'];
	const terms =
		language === 'he'
			? ['בוצע', 'מתוכנן', 'סה״כ']
			: ['done', 'planned', 'total'];
	for (const [index, row] of rows.entries()) {
		const label = row.text[0];
		expect(label.text).toBe(labels[index % 2]);
		expect(row.direction).toBe(language === 'he' ? 'rtl' : 'ltr');
		expect(row.groups).toHaveLength(row.category ? 3 : 2);
		expect(
			row.text.filter((item) => item.tag === 'DT').map((item) => item.text)
		).toEqual(terms.slice(0, row.category ? 3 : 2));
		expect(
			row.valuesOverflow,
			`${label.text}: values stay in their track`
		).toBeLessThanOrEqual(1);
		expect(row.left).toBeGreaterThanOrEqual(0);
		expect(row.right).toBeLessThanOrEqual(row.viewport);
		expect(row.values.left).toBeGreaterThanOrEqual(row.left - 0.5);
		expect(row.values.right).toBeLessThanOrEqual(row.right + 0.5);
		const ordered = [label, ...row.groups];
		for (let i = 1; i < ordered.length; i++) {
			expect(
				row.direction === 'rtl'
					? ordered[i - 1].left - ordered[i].right
					: ordered[i].left - ordered[i - 1].right,
				`${label.text}: separate label and value groups on one row`
			).toBeGreaterThanOrEqual(0);
		}
		for (const group of row.groups) {
			expect(group.left).toBeGreaterThanOrEqual(row.values.left - 0.5);
			expect(group.right).toBeLessThanOrEqual(row.values.right + 0.5);
		}
		for (const item of row.text) {
			const description = `${label.text}: ${item.text}`;
			expect(item.text, description).not.toBe('');
			expect(item.fontSize, description).toBe(
				item.tag === 'DT' ? '12px' : '13px'
			);
			expect(item.whiteSpace, description).toBe('nowrap');
			expect(item.overflowX, description).toBe('visible');
			expect(item.visibility, description).toBe('visible');
			expect(item.lineClamp, description).toBe('none');
			expect(item.lines, description).toBe(1);
			expect(item.textFits, description).toBe(true);
			expect(item.overflow, description).toBeLessThanOrEqual(1);
			expect(
				Math.abs(item.baseline - label.baseline),
				`${description}: shared baseline`
			).toBeLessThanOrEqual(0.5);
			expect(item.left, description).toBeGreaterThanOrEqual(row.left - 0.5);
			expect(item.right, description).toBeLessThanOrEqual(row.right + 0.5);
		}
	}
}

async function expectOriginalCardHierarchy(card: Locator) {
	const body = card.locator('.course-body');
	const name = body.locator('.course-copy > .course-name');
	await expect(name).toBeVisible();
	const title = await name.getAttribute('title');
	expect(title).toBeTruthy();
	await expect(name).toHaveText(title!);
	for (const text of [name, body.locator('.course-code')]) {
		await expect(text).toHaveCSS('font-size', '12px');
		await expect(text).toHaveCSS('line-height', '12px');
		await expect(text).toHaveCSS('font-weight', '400');
	}
	for (const text of await body
		.locator('.course-median, .course-points, .course-note')
		.all()) {
		await expect(text).toHaveCSS('font-size', '12px');
		await expect(text).toHaveCSS('line-height', '16px');
		await expect(text).toHaveCSS('font-weight', '400');
	}
	await expect(name).toHaveCSS('-webkit-line-clamp', '3');
	await expect(name).toHaveCSS('-webkit-box-orient', 'vertical');
	await expect(name).toHaveCSS('overflow', 'hidden');
	const nameBox = await name.boundingBox();
	const lineHeight = await name.evaluate((element) =>
		parseFloat(getComputedStyle(element).lineHeight)
	);
	expect(nameBox!.height).toBeLessThanOrEqual(3 * lineHeight + 0.5);
	const action = name.locator('xpath=ancestor::*[self::a or self::button][1]');
	if (await action.count())
		await expect(action).toHaveAccessibleName(
			new RegExp(title!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		);
	await expect(name).toHaveCSS('white-space', 'normal');
	await expect(body.locator('.course-copy')).toHaveCSS('white-space', 'normal');
	await expect(body.locator('.course-copy')).toHaveCSS('overflow', 'visible');
	await expect(body.locator('.course-copy')).toHaveCSS(
		'-webkit-line-clamp',
		'none'
	);
	await expect(body.locator('.course-name + .course-code')).toHaveCount(1);
	await expect(body.locator('.course-copy')).toHaveCSS('display', 'block');
	const squeezed = await body.evaluate((element) =>
		element.classList.contains('course-body-squeezed')
	);
	await expect(body.locator('.course-copy')).toHaveCSS(
		'min-height',
		squeezed ? '0px' : '72px'
	);
	await expect(body.locator('.course-code')).toHaveAttribute('dir', 'ltr');
	const codeBox = await body.locator('.course-code').boundingBox();
	const cardBox = await card.boundingBox();
	const copyBox = await body.locator('.course-copy').boundingBox();
	if (!squeezed) expect(copyBox!.height).toBeGreaterThanOrEqual(72);
	expect(codeBox!.y).toBeGreaterThanOrEqual(
		nameBox!.y + nameBox!.height - lineHeight - 0.5
	);
	expect(codeBox!.y).toBeLessThanOrEqual(nameBox!.y + nameBox!.height + 0.5);
	expect(codeBox!.y + codeBox!.height).toBeLessThanOrEqual(
		copyBox!.y + copyBox!.height + 0.5
	);
	expect(codeBox!.x).toBeGreaterThanOrEqual(cardBox!.x - 0.5);
	expect(codeBox!.x + codeBox!.width).toBeLessThanOrEqual(
		cardBox!.x + cardBox!.width + 0.5
	);
	expect(codeBox!.height).toBeGreaterThan(0);
	await expect(
		body.locator('.course-meta .course-markers .course-marker')
	).toBeVisible();
	await expect(
		body.locator('.course-meta .course-stats > .course-median')
	).toBeVisible();
	await expect(body.locator('.course-median + .course-points')).toBeVisible();
	await expect(body).toHaveCSS('padding', '6px');
	const hierarchy = await body.evaluate((el) => {
		const meta = el.querySelector('.course-meta')!;
		const copy = el.querySelector('.course-copy')!;
		return {
			children: Array.from(el.children, (child) =>
				child.classList.contains('course-meta')
					? 'metadata'
					: child.classList.contains('course-copy')
						? 'copy'
						: 'other'
			),
			metadataBottom: meta.getBoundingClientRect().bottom,
			copyTop: copy.getBoundingClientRect().top
		};
	});
	expect(hierarchy.children).toEqual(['metadata', 'copy']);
	expect(hierarchy.metadataBottom).toBeLessThanOrEqual(hierarchy.copyTop);
}

test('deployed /storybook opens the real Storybook manager and survives a direct reload', async ({
	page,
	request
}) => {
	const redirect = await request.get(`/storybook?path=/story/${controls}`, {
		maxRedirects: 0
	});
	expect(redirect.status()).toBe(307);
	const target = new URL(redirect.headers().location, redirect.url());
	expect(target.origin).toBe(new URL(redirect.url()).origin);
	expect(target.pathname).toBe('/storybook/index.html');
	expect(target.searchParams.get('path')).toBe(`/story/${controls}`);
	const slash = await request.get('/storybook/');
	expect(slash.ok()).toBe(true);
	await page.goto(`/storybook?path=/story/${controls}`);
	await expect(page.locator('#storybook-preview-iframe')).toBeVisible();
	await expect(
		page
			.frameLocator('#storybook-preview-iframe')
			.getByRole('button', { name: 'Add semester' })
	).toBeVisible();
	await page.reload();
	await expect(
		page
			.frameLocator('#storybook-preview-iframe')
			.getByRole('button', { name: 'Add semester' })
	).toBeVisible();
});

test('all stories render without live data, account access, or planner storage changes', async ({
	page,
	request,
	baseURL
}) => {
	const index = await request.get('/storybook/index.json');
	expect(index.ok()).toBe(true);
	const entries = Object.values((await index.json()).entries) as {
		id: string;
		type: string;
	}[];
	const stories = entries.filter((entry) => entry.type === 'story');
	expect(stories.length).toBe(
		coverage.reduce((count, entry) => count + entry.stories.length, 0)
	);
	test.setTimeout(300_000);
	const failures: string[] = [];
	page.on('pageerror', (error) => failures.push(error.message));
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (!['http:', 'https:'].includes(url.protocol)) return;
		if (
			url.origin !== new URL(baseURL!).origin ||
			/(?:_courses|_catalogs|courseData|catalogs\.json|service-worker)/.test(
				url.pathname
			)
		)
			failures.push(`Unexpected request: ${url.origin}${url.pathname}`);
	});
	await page.addInitScript(() => {
		localStorage.setItem('userData', '{"storybookSentinel":true}');
		localStorage.setItem('theme', 'sentinel');
		localStorage.setItem('lang', 'sentinel');
		localStorage.setItem('version', 'sentinel');
		sessionStorage.setItem(
			'planit-dismissed-update-version',
			'storybook-update-v2'
		);
		const reads: string[] = [];
		Object.assign(window, { plannerStorageReads: reads });
		const openDatabase = IDBFactory.prototype.open;
		IDBFactory.prototype.open = function (...args) {
			reads.push('IndexedDB:' + args[0]);
			return openDatabase.apply(this, args);
		};
		const original = Storage.prototype.getItem;
		Storage.prototype.getItem = function (key) {
			if (
				[
					'userData',
					'version',
					'lang',
					'theme',
					'username',
					'degree',
					'semesters',
					'wishlist',
					'planit-dismissed-update-version'
				].includes(key)
			)
				reads.push(key);
			return original.call(this, key);
		};
	});
	for (const story of stories) {
		await test.step(story.id, async () => {
			await page.goto(storyUrl(story.id));
			await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
				'data-story-rendered',
				story.id,
				// Storybook waits up to 5s for scroll-linked animations before afterEach.
				{ timeout: 15_000 }
			);
			await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
			expect(
				await page.evaluate(
					() =>
						(window as Window & { plannerStorageReads: string[] })
							.plannerStorageReads
				)
			).toEqual([]);
			expect(
				await page.evaluate(() => ({
					data: localStorage.getItem('userData'),
					theme: localStorage.getItem('theme'),
					lang: localStorage.getItem('lang'),
					version: localStorage.getItem('version'),
					dismissedUpdate: sessionStorage.getItem(
						'planit-dismissed-update-version'
					)
				}))
			).toEqual({
				data: '{"storybookSentinel":true}',
				theme: 'sentinel',
				lang: 'sentinel',
				version: 'sentinel',
				dismissedUpdate: 'storybook-update-v2'
			});
		});
	}
	expect(
		await page.evaluate(
			async () => (await navigator.serviceWorker.getRegistrations()).length
		)
	).toBe(0);
	expect(failures).toEqual([]);
});

test('individual controls are interactive and disabled states stay disabled', async ({
	page
}) => {
	await page.goto(storyUrl(controls));
	await expectCompactAction(page.getByRole('button', { name: 'Add semester' }));
	await page.getByRole('button', { name: 'Add semester' }).click();
	await expect(page.getByText('Semesters added: 1')).toBeVisible();
	await page.goto(storyUrl('components-asyncbutton--primary'));
	const save = page.getByRole('button', { name: 'Save plan', exact: true });
	await expectCompactAction(save);
	const idleWidth = (await save.boundingBox())!.width;
	await save.click();
	await expect(
		page.getByRole('button', { name: 'Save plan', exact: true })
	).toBeDisabled();
	await expect(
		page.getByRole('button', { name: 'Save plan', exact: true })
	).toHaveAttribute('aria-busy', 'true');
	await expectCompactAction(save);
	expect((await save.boundingBox())!.width).toBe(idleWidth);
	await page.getByRole('button', { name: 'Complete demo action' }).click();
	await expect(page.getByText('Completed actions: 1')).toBeVisible();
	await page.goto(storyUrl('components-button--disabled-primary'));
	await expect(
		page.getByRole('button', { name: 'Add semester' })
	).toBeDisabled();
	await page.goto(storyUrl('components-select--disabled'));
	await expect(page.getByRole('combobox')).toBeDisabled();
	for (const state of ['offline', 'offline-hidden-reason']) {
		await page.goto(storyUrl(`components-planactionbutton--${state}`));
		const action = page.getByRole('button', { name: 'Save demo plan' });
		await expect(action).toBeDisabled();
		await expectCompactAction(action);
		await expect(action).toHaveAccessibleDescription(
			/Reconnect to edit or save/
		);
		await expect(page.getByText('Demo saves: 0')).toBeVisible();
		const reason = await action.evaluate((el) => {
			const reason = document.getElementById(
				el.getAttribute('aria-describedby')!
			);
			return (
				reason && {
					position: getComputedStyle(reason).position,
					height: reason.getBoundingClientRect().height
				}
			);
		});
		expect(reason).not.toBeNull();
		if (state === 'offline-hidden-reason') {
			expect(reason!.position).toBe('absolute');
			expect(reason!.height).toBeLessThanOrEqual(1);
		} else expect(reason!.height).toBeGreaterThan(1);
	}
});

test('theme, language and reading direction are global controls', async ({
	page
}) => {
	await page.goto(
		`${storyUrl(controls)}&globals=theme:light;language:he;direction:rtl`
	);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
	await expect(page.getByRole('button', { name: 'הוספת סמסטר' })).toBeVisible();
	await page.goto(
		`${storyUrl('components-consoleloading--courses')}&globals=theme:dark;language:en;direction:rtl`
	);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.locator('.console-loading')).toHaveAttribute('dir', 'rtl');
	await expect(
		page.locator('.console-loading').getByRole('heading')
	).toHaveCount(0);
	await expect(page.locator('.console-loading__logo')).toBeVisible();
	await expect(
		page.getByRole('img', { name: 'PlanIt', exact: true })
	).toBeVisible();
	await expect(page.locator('.console-loading__track')).toBeVisible();
	await expect(page.getByRole('status')).toHaveText('Loading courses…');
	await expect(page.getByRole('status')).toHaveCSS('clip-path', 'inset(50%)');
	await page.goto(
		`${storyUrl('components-searchfilters--default')}&globals=theme:light;language:en;direction:ltr`
	);
	await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
	await expect(
		page.getByRole('group', { name: 'Filters', exact: true })
	).toBeVisible();
	await page.goto(storyUrl('components-pwastatus--update-refresh-failure'));
	await expect(page.getByTestId('pwa-refresh-error')).toHaveText(
		pwaMessages.en.cachedRefreshFailed
	);
	for (const language of ['he', 'en'] as const) {
		// Use the same Storybook channel event as its toolbar, without reloading
		// the iframe: global changes must keep the active fixture's details.
		await page.evaluate((language) => {
			const channel = (
				window as Window & {
					__STORYBOOK_ADDONS_CHANNEL__: {
						emit: (event: string, payload: unknown) => void;
					};
				}
			).__STORYBOOK_ADDONS_CHANNEL__;
			channel.emit('updateGlobals', {
				globals: {
					language,
					theme: language === 'he' ? 'light' : 'dark',
					direction: language === 'he' ? 'rtl' : 'ltr'
				}
			});
		}, language);
		await expect(page.locator('html')).toHaveAttribute('lang', language);
		await expect(page.locator('html')).toHaveAttribute(
			'dir',
			language === 'he' ? 'rtl' : 'ltr'
		);
		await expect(page.locator('html')).toHaveAttribute(
			'data-theme',
			language === 'he' ? 'light' : 'dark'
		);
		await expect(page.getByTestId('pwa-refresh-error')).toHaveText(
			pwaMessages[language].cachedRefreshFailed
		);
		await expect(page.getByTestId('pwa-error-detail')).toBeVisible();
		await expect(page.getByTestId('pwa-error')).toBeVisible();
		await expectPwaUpdateBanner(page, language, true);
	}
	// Controls update the same component instance. Each variant must replace
	// the full fixture so a previous error cannot leak into Ready or setup failure.
	for (const state of ['ready', 'update', 'outdated', 'unavailable', 'ready']) {
		await page.evaluate((state) => {
			(
				window as Window & {
					__STORYBOOK_ADDONS_CHANNEL__: {
						emit: (event: string, payload: unknown) => void;
					};
				}
			).__STORYBOOK_ADDONS_CHANNEL__.emit('updateStoryArgs', {
				storyId: 'components-pwastatus--update-refresh-failure',
				updatedArgs: { state }
			});
		}, state);
		await expect(page.getByTestId('pwa-refresh-error')).toHaveCount(0);
		await expectPwaUpdateBanner(page, 'en', state === 'update');
		if (state !== 'unavailable') {
			await expect(page.getByTestId('pwa-status')).toHaveAttribute(
				'data-state',
				state === 'outdated' ? 'outdated' : 'ready'
			);
			await expect(page.getByTestId('pwa-status-details')).toHaveCount(0);
		} else {
			await expect(page.getByTestId('pwa-incomplete')).toBeVisible();
			await expect(page.getByTestId('pwa-error-detail')).toHaveText(
				'Example offline setup failed: browser storage quota exceeded.'
			);
		}
	}
});

test('the app service worker and app HTML do not load Storybook', async ({
	request
}) => {
	const worker = await request.get('/service-worker.js');
	expect(worker.ok()).toBe(true);
	expect(await worker.text()).not.toMatch(/storybook|src\/stories/i);
	for (const route of ['/', '/app/offline']) {
		const response = await request.get(route);
		expect(response.ok()).toBe(true);
		expect(await response.text()).not.toMatch(
			/(?:src|href)=["'][^"']*storybook/i
		);
	}
});

test('footer preferences have equal centered controls and leave real planner preferences untouched', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('theme', 'dark');
		localStorage.setItem('lang', 'en');
	});
	for (const width of [320, 390]) {
		await page.setViewportSize({ width, height: 800 });
		for (const state of ['default', 'compact']) {
			for (const language of ['en', 'he']) {
				const direction = language === 'he' ? 'rtl' : 'ltr';
				await page.goto(
					`${storyUrl(`components-appfooter--${state}`)}&globals=language:${language};direction:${direction};theme:dark`
				);
				const select = page.getByRole('combobox');
				await expect(select.locator('option:checked')).toHaveText(
					language === 'he' ? 'עב' : 'en'
				);
				await expectFooterPreferenceGeometry(page, state === 'compact');
				await page.screenshot({
					path: test
						.info()
						.outputPath(`footer-controls-${state}-${width}-${language}.png`),
					fullPage: false
				});
				await page.getByRole('button').click();
				await expect(page.locator('html')).toHaveAttribute(
					'data-theme',
					'light'
				);
				const nextLabel = language === 'he' ? 'en' : 'עב';
				await select.selectOption({ label: nextLabel });
				await expect(select.locator('option:checked')).toHaveText(nextLabel);
				await expectFooterPreferenceGeometry(page, state === 'compact');
				expect(
					await page.evaluate(() => [
						localStorage.getItem('theme'),
						localStorage.getItem('lang')
					])
				).toEqual(['dark', 'en']);
			}
		}
	}
});

test('footer and installation links are mocked and cannot leave the story', async ({
	page,
	context
}) => {
	await page.goto(storyUrl('components-landinginstallinfo--default'));
	const before = page.url();
	await expect(
		page.getByRole('heading', { name: 'Add to your home screen' })
	).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Prepare for offline reading' })
	).toBeVisible();
	await page.getByRole('link', { name: 'Open PlanIt' }).click();
	expect(page.url()).toBe(before);
	await page.goto(storyUrl('components-appfooter--default'));
	const footerUrl = page.url();
	await page.locator('a[href="https://github.com/selfint"]').click();
	expect(page.url()).toBe(footerUrl);
	await page.goto(storyUrl('components-pwastatus--ready'));
	await expect(page.getByTestId('pwa-install-help')).toHaveCount(0);
	expect(context.pages()).toHaveLength(1);
});

test('CourseGroup resolves actual async data and exposes loading and error states', async ({
	page
}) => {
	await page.goto(storyUrl('components-coursegroup--default'));
	await expect(
		page.getByText('Example foundations · יסודות לדוגמה')
	).toBeVisible();
	await expect(page.locator('a[href="/app/course/00000001"]')).toBeVisible();
	await page.goto(storyUrl('components-coursegroup--loading'));
	await expect(page.getByRole('status')).toBeVisible();
	await expect(
		page.getByText('Example foundations · יסודות לדוגמה')
	).not.toBeVisible();
	await page.goto(storyUrl('components-coursegroup--error'));
	await expect(page.getByRole('alert')).toBeVisible();
});

test('console titlebar keeps brand, search and navigation on one row without PWA controls', async ({
	page
}) => {
	test.setTimeout(60_000);
	for (const width of [320, 390, 1180]) {
		for (const language of ['en', 'he']) {
			await page.setViewportSize({ width, height: 664 });
			await page.goto(
				`${storyUrl('components-titlebar--query')}&globals=language:${language};theme:${language === 'he' ? 'dark' : 'light'}`
			);
			const header = page.locator('header.title-bar');
			await expect(header.locator('a.brand')).toHaveAttribute('href', '/');
			await expect(header.locator('a.brand')).toHaveAttribute(
				'data-sveltekit-reload',
				''
			);
			await expect(header).toBeVisible();
			await expect(header).toHaveAttribute('dir', 'ltr');
			await expect(header.locator('form')).toHaveAttribute(
				'dir',
				language === 'he' ? 'rtl' : 'ltr'
			);
			await expect(header.getByTestId('pwa-status')).toHaveCount(0);
			await expect(header.getByTestId('pwa-update-link')).toHaveCount(0);
			const boxes = await header.evaluate((el) => {
				const box = (child: Element) => {
					const r = child.getBoundingClientRect();
					return {
						left: r.left,
						right: r.right,
						center: r.top + r.height / 2,
						height: r.height
					};
				};
				return {
					header: box(el),
					items: ['.brand', '.header-search', 'nav'].map((selector) =>
						box(el.querySelector(selector)!)
					),
					overflow: document.documentElement.scrollWidth - innerWidth
				};
			});
			expect(boxes.header.height).toBe(48);
			for (const item of boxes.items) {
				expect(item.center).toBeCloseTo(boxes.header.center, 1);
				expect(item.left).toBeGreaterThanOrEqual(boxes.header.left);
				expect(item.right).toBeLessThanOrEqual(boxes.header.right);
			}
			expect(boxes.items[0].right).toBeLessThanOrEqual(boxes.items[1].left);
			expect(boxes.items[1].right).toBeLessThanOrEqual(boxes.items[2].left);
			expect(boxes.overflow).toBeLessThanOrEqual(1);
			const input = header.getByRole('textbox');
			await expect(input).toHaveValue('Example systems');
			await expect(input).toHaveCSS('font-size', '14px');
			await expect(input).toHaveCSS('line-height', '21px');
			for (const link of await header.locator('.nav-link').all()) {
				await expect(link).toHaveCSS('font-size', '14px');
				await expect(link).toHaveCSS('line-height', '21px');
				await expect(link).toHaveCSS('white-space', 'nowrap');
			}
			const alignment = await header.evaluate((element) => {
				const box = (selector: string) => {
					const { left, top, width, height } = element
						.querySelector(selector)!
						.getBoundingClientRect();
					return { width, height, x: left + width / 2, y: top + height / 2 };
				};
				return {
					logo: box('.brand-logo'),
					form: box('.header-search'),
					input: box('input'),
					icon: box('.search-icon'),
					svg: box('.search-icon svg'),
					path: box('.search-icon path')
				};
			});
			const logoSize = width < 640 ? 28 : 32;
			expect(alignment.logo.width).toBe(logoSize);
			expect(alignment.logo.height).toBe(logoSize);
			expect(alignment.logo.y).toBeCloseTo(boxes.header.center, 1);
			for (const icon of [alignment.icon, alignment.svg, alignment.path]) {
				expect(icon.width).toBeCloseTo(width < 640 ? 14 : 16, 1);
				expect(icon.height).toBeCloseTo(width < 640 ? 14 : 16, 1);
				expect(icon.x).toBeCloseTo(alignment.icon.x, 1);
				expect(icon.y).toBeCloseTo(alignment.form.y, 1);
				expect(icon.y).toBeCloseTo(alignment.input.y, 1);
			}
			await expect(header.locator('.search-icon svg')).toHaveCSS(
				'display',
				'block'
			);
			await input.fill('Example query');
			await input.press('Enter');
			await expect(page.getByText('Submitted: Example query')).toBeVisible();
			await page.screenshot({
				path: test.info().outputPath(`titlebar-${width}-${language}.png`),
				fullPage: false
			});
		}
	}
});

test('settings navigation icon scales with root typography and stays centered', async ({
	page
}) => {
	// Keep enough room for the desktop header at the largest text size.
	await page.setViewportSize({ width: 1600, height: 900 });
	for (const language of ['en', 'he']) {
		const id = 'components-titlebar--query';
		await page.goto(
			`${storyUrl(id)}&globals=language:${language};direction:${language === 'he' ? 'rtl' : 'ltr'}`
		);
		await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
			'data-story-rendered',
			id,
			{ timeout: 15_000 }
		);
		const settings = page.locator('header.title-bar').getByRole('link', {
			name: language === 'he' ? 'הגדרות' : 'Settings',
			exact: true
		});
		await expect(settings).toHaveAttribute('href', '/app/settings');
		for (const pixels of [16, 20, 24]) {
			await test.step(`${language}, ${pixels}px root`, async () => {
				await withRootFontSize(page, pixels, async () => {
					await expectScaledIcon(
						settings.locator('svg'),
						settings,
						pixels * 1.5,
						true
					);
				});
			});
		}
	}
});

test('guest and signed-in settings icons share rem sizing and centered action bounds', async ({
	page
}) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1600, height: 900 });
	for (const language of ['en', 'he']) {
		for (const state of ['guest', 'signed-in']) {
			const id = `pages-settings--${state}`;
			// Each story navigation mounts a fresh, memory-only auth fixture.
			await page.goto(
				`${storyUrl(id)}&globals=language:${language};direction:${language === 'he' ? 'rtl' : 'ltr'}`
			);
			await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
				'data-story-rendered',
				id,
				{ timeout: 15_000 }
			);
			const account = page.locator('.account-section');
			const button = account.getByRole('button');
			const action = button.locator('.account-action');
			const icon = action.locator(state === 'guest' ? 'img' : 'svg');
			await expect(account.getByRole('heading')).toHaveText(
				state === 'signed-in'
					? 'Example Student'
					: language === 'he'
						? 'אורח'
						: 'Guest'
			);
			await expect(button).toBeEnabled();
			for (const pixels of [16, 20, 24]) {
				await test.step(`${state}, ${language}, ${pixels}px root`, async () => {
					await withRootFontSize(page, pixels, async () => {
						await expect(icon).toHaveCSS('flex-shrink', '0');
						await expectScaledIcon(icon, button, pixels * 1.25);
						await expectSingleRenderedLine(action.locator(':scope > span'));
						const [contents, control] = await Promise.all([
							action.boundingBox(),
							button.boundingBox()
						]);
						for (const axis of ['x', 'y'] as const) {
							const size = axis === 'x' ? 'width' : 'height';
							expect(contents![axis] + contents![size] / 2).toBeCloseTo(
								control![axis] + control![size] / 2,
								1
							);
						}
					});
				});
			}
		}
	}
});

async function expectPwaUpdateBanner(
	page: Page,
	language: 'en' | 'he',
	visible: boolean,
	version = 'storybook-update-v2'
) {
	const banner = page.getByTestId('pwa-update-banner');
	await expect(banner).toHaveCount(visible ? 1 : 0);
	await expect(page.getByTestId('pwa-update')).toHaveCount(visible ? 1 : 0);
	await expect(page.getByTestId('pwa-update-link')).toHaveCount(0);
	await expect(page.locator('footer').getByTestId('pwa-update')).toHaveCount(0);
	if (!visible) return;
	await expect(banner).toBeVisible();
	await expect(banner.getByRole('status')).toHaveText(
		pwaMessages[language].update
	);
	await expect(banner).toHaveAttribute('data-update-version', version);
	await expect(banner.locator('a, details, summary')).toHaveCount(0);
	await expect(banner.getByRole('button')).toHaveCount(1);
	const dismiss = banner.getByTestId('pwa-update-dismiss');
	await expect(dismiss).toHaveAccessibleName(pwaMessages[language].close);
	await expect(dismiss).toBeEnabled();
	const dismissBounds = await dismiss.boundingBox();
	for (const size of [dismissBounds!.width, dismissBounds!.height]) {
		expect(size).toBeGreaterThanOrEqual(35.5);
		expect(size).toBeLessThanOrEqual(36.5);
	}
	await expect(
		page.locator('header').getByTestId('pwa-update-banner')
	).toHaveCount(0);
	const [header, bounds, footer] = await Promise.all([
		page.locator('header').boundingBox(),
		banner.boundingBox(),
		page.locator('footer').boundingBox()
	]);
	expect(bounds!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(footer!.y);
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
		page.viewportSize()!.width
	);
	expect(
		bounds!.height,
		'a compact notice, including narrow-screen wrapping'
	).toBeLessThanOrEqual(80);
	const text = banner.getByTestId('pwa-update');
	expect(
		await text.evaluate((element) => element.scrollWidth - element.clientWidth)
	).toBeLessThanOrEqual(1);
}

test('PWA footer keeps healthy readiness accessible and shows actionable status', async ({
	page
}) => {
	test.setTimeout(60_000);
	for (const [width, language] of [
		[320, 'he'],
		[390, 'en']
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		for (const state of ['initial', 'preparing', 'offline', 'ready']) {
			const id = `components-pwastatus--${state}`;
			await page.goto(
				`${storyUrl(id)}&globals=language:${language};theme:${language === 'he' ? 'dark' : 'light'}`
			);
			await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
				'data-story-rendered',
				id
			);
			await expect(page.getByTestId('pwa-status')).toHaveAttribute(
				'data-state',
				state === 'ready' || state === 'offline' ? 'ready' : 'preparing'
			);
			await expect(page.locator('details, summary')).toHaveCount(0);
			await expect(page.getByTestId('pwa-status-details')).toHaveCount(0);
			await expectPwaUpdateBanner(page, language, false);
			const readiness = page.getByRole('status');
			if (state === 'initial' || state === 'ready') {
				await expect(readiness).toHaveClass(/\bsr-only\b/);
				await expect(readiness).toHaveCSS('position', 'absolute');
				const box = await readiness.boundingBox();
				expect(box!.width).toBeLessThanOrEqual(1);
				expect(box!.height).toBeLessThanOrEqual(1);
			} else {
				await expect(readiness).not.toHaveClass(/\bsr-only\b/);
				await expect(readiness).toHaveCSS('position', 'static');
			}
			await expectPwaFooter(page);
			if (state === 'initial')
				await expect(page.getByRole('status')).toBeEmpty();
			else {
				if (state !== 'ready') await expect(readiness).toBeVisible();
				await expect(page.getByRole('status')).toHaveText(
					state === 'ready'
						? pwaMessages[language].ready
						: state === 'offline'
							? language === 'he'
								? 'אין אינטרנט'
								: 'Offline'
							: pwaMessages[language].downloading
				);
			}
			if (state === 'offline')
				await page.screenshot({
					path: test.info().outputPath(`pwa-offline-${width}-${language}.png`),
					fullPage: false
				});
		}
		await page.screenshot({
			path: test.info().outputPath(`pwa-ready-${width}-${language}.png`),
			fullPage: false
		});
	}

	for (const [width, language, theme, direction] of [
		[320, 'he', 'light', 'rtl'],
		[390, 'en', 'dark', 'ltr']
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		for (const state of ['unavailable', 'outdated', 'update']) {
			await page.goto(
				`${storyUrl(`components-pwastatus--${state}`)}&globals=language:${language};theme:${theme};direction:${direction}`
			);
			const root = page.getByTestId('pwa-status');
			const detail = page.getByTestId('pwa-status-details');
			await expect(
				page.locator('details, summary, [role="dialog"]')
			).toHaveCount(0);
			await expectPwaFooter(page);
			await expectPwaUpdateBanner(page, language, state === 'update');
			await expect(root).toHaveAttribute(
				'data-state',
				state === 'unavailable'
					? 'error'
					: state === 'outdated'
						? 'outdated'
						: 'ready'
			);
			if (state !== 'unavailable') {
				await expect(detail).toHaveCount(0);
				await expect(root.locator('a, button')).toHaveCount(0);
				await expect(page.getByTestId('pwa-incomplete')).toHaveCount(0);
				if (state === 'outdated') {
					await expect(root.getByRole('status')).toBeVisible();
					await expect(root.getByRole('status')).not.toHaveClass(/\bsr-only\b/);
					await expect(root.getByRole('status')).toHaveText(
						pwaMessages[language].shellOutdated
					);
				}
				continue;
			}
			await expect(detail).toBeVisible();
			await expect(detail).toHaveAttribute('id', 'offline-status');
			await expect(detail).toHaveCSS('position', 'static');
			await expect(
				page.getByTestId('pwa-footer-row').getByTestId('pwa-status-details')
			).toHaveCount(1);
			await expect(page.getByTestId('pwa-incomplete')).toBeVisible();
			await expect(page.getByTestId('pwa-error')).toHaveCount(1);
			await expect(page.getByTestId('pwa-error-detail')).toHaveText(
				'Example offline setup failed: browser storage quota exceeded.'
			);
			await expect(page.getByTestId('pwa-error-detail')).toHaveAttribute(
				'dir',
				'auto'
			);
			await expect(page.getByTestId('pwa-refresh-error')).toHaveCount(0);
			const bounds = await detail.boundingBox();
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
			const retry = root.getByRole('button', { name: /^(Retry|נסו שוב)$/ });
			await expectCompactAction(retry);
			await retry.click();
			await expect(page.getByText('Retry requests: 1')).toBeVisible();
			await expect(page.getByTestId('pwa-incomplete')).toBeVisible();
			const link = root.getByRole('link');
			await expect(link).toHaveCount(1);
			await expect(link).toHaveAccessibleName(/\S/);
			await expect(link).toHaveAttribute('href', '#offline-status');
			const before = page.url();
			await link.focus();
			await link.press('Enter');
			// Only the real error link targets this always-visible footer diagnostic.
			await expect(detail).toBeFocused();
			expect(page.url()).toBe(before);
			await expect(detail).toBeVisible();
			await expect(
				page.getByRole('button', { name: /^(Close|סגירה)$/ })
			).toHaveCount(0);
		}
	}
	expect(
		await page.evaluate(
			async () => (await navigator.serviceWorker.getRegistrations()).length
		)
	).toBe(0);
});

test('offline updates keep the footer status visible after dismissal and retain error precedence', async ({
	page
}) => {
	test.setTimeout(60_000);
	const id = 'components-pwastatus--offline-update';
	for (const [width, language, theme, direction] of [
		[320, 'he', 'dark', 'rtl'],
		[390, 'en', 'light', 'ltr']
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		await page.goto(
			`${storyUrl(id)}&globals=language:${language};theme:${theme};direction:${direction}`
		);
		await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
			'data-story-rendered',
			id
		);
		const changeArgs = async (updatedArgs: Record<string, string | boolean>) =>
			page.evaluate(
				({ id, updatedArgs }) => {
					(
						window as Window & {
							__STORYBOOK_ADDONS_CHANNEL__: {
								emit: (event: string, payload: unknown) => void;
							};
						}
					).__STORYBOOK_ADDONS_CHANNEL__.emit('updateStoryArgs', {
						storyId: id,
						updatedArgs
					});
				},
				{ id, updatedArgs }
			);
		const status = page.locator('footer').getByTestId('pwa-status');
		const readiness = status.getByRole('status');
		const expectOffline = async () => {
			await expect(readiness).toHaveText(
				language === 'he' ? 'אין אינטרנט' : 'Offline'
			);
			await expect(readiness).not.toHaveClass(/\bsr-only\b/);
			await expect(readiness).toHaveCSS('position', 'static');
			await expect(readiness).toBeVisible();
			const bounds = await readiness.boundingBox();
			expect(bounds!.width).toBeGreaterThan(1);
			expect(bounds!.height).toBeGreaterThan(1);
			await expect(page.getByTestId('pwa-error')).toHaveCount(0);
			await expect(page.getByTestId('pwa-status-details')).toHaveCount(0);
			await expectPwaFooter(page);
		};
		await expectPwaUpdateBanner(page, language, true);
		await expectOffline();
		await page.getByTestId('pwa-update-dismiss').click();
		await expectPwaUpdateBanner(page, language, false);
		await expectOffline();
		await page.screenshot({
			path: test
				.info()
				.outputPath(`pwa-offline-update-dismissed-${width}-${language}.png`),
			fullPage: false
		});
		// Repeated fixture transitions keep the same dismissed version and the
		// visible Offline state, without relying on a new component mount.
		for (const state of ['offline', 'offlineUpdate']) {
			await changeArgs({ state });
			await expectPwaUpdateBanner(page, language, false);
			await expectOffline();
		}
		// A refresh failure while still offline must win over the Offline label,
		// independently of whether the new waiting version's notice is dismissed.
		await changeArgs({
			state: 'refreshUpdate',
			offline: true,
			updateVersion: 'storybook-update-v3'
		});
		await expectPwaUpdateBanner(page, language, true, 'storybook-update-v3');
		for (const dismissed of [false, true]) {
			if (dismissed) {
				await page.getByTestId('pwa-update-dismiss').click();
				await expectPwaUpdateBanner(page, language, false);
			}
			await expect(readiness).toHaveClass(/\bsr-only\b/);
			await expect(readiness).toHaveText(
				pwaMessages[language].cachedRefreshFailed
			);
			await expect(page.getByTestId('pwa-error')).toHaveCount(1);
			const error = status.getByRole('link');
			await expect(error).toHaveCount(1);
			await expect(error).toBeVisible();
			await expect(error).toHaveText(language === 'he' ? 'שגיאה' : 'Error');
			await expect(error).toHaveAttribute('href', '#offline-status');
			const retry = status.getByRole('button', {
				name: language === 'he' ? 'נסו שוב' : 'Retry',
				exact: true
			});
			await expectCompactAction(retry);
			await retry.click();
			await expect(
				page.getByText(`Retry requests: ${dismissed ? 2 : 1}`)
			).toBeVisible();
			await expect(page.getByTestId('pwa-refresh-error')).toBeVisible();
			await expect(page.getByTestId('pwa-error-detail')).toHaveText(
				'Example course refresh failed: response validation rejected missing course names.'
			);
			await expectPwaFooter(page);
		}
		await changeArgs({ state: 'offlineUpdate' });
		await expectOffline();
		await expectPwaUpdateBanner(page, language, false);
	}
});

test('PWA dismissal follows versions without reading or writing the real session', async ({
	page
}) => {
	await page.addInitScript(() =>
		sessionStorage.setItem(
			'planit-dismissed-update-version',
			'storybook-update-v2'
		)
	);
	const id = 'components-pwastatus--update';
	await page.goto(storyUrl(id));
	await expectPwaUpdateBanner(page, 'en', true);
	const changeArgs = async (updatedArgs: Record<string, string>) =>
		page.evaluate(
			({ id, updatedArgs }) => {
				(
					window as Window & {
						__STORYBOOK_ADDONS_CHANNEL__: {
							emit: (event: string, payload: unknown) => void;
						};
					}
				).__STORYBOOK_ADDONS_CHANNEL__.emit('updateStoryArgs', {
					storyId: id,
					updatedArgs
				});
			},
			{ id, updatedArgs }
		);
	await page.getByTestId('pwa-update-dismiss').click();
	await expectPwaUpdateBanner(page, 'en', false);
	for (const state of ['ready', 'update', 'outdated', 'refreshUpdate']) {
		await changeArgs({ state });
		await expectPwaUpdateBanner(page, 'en', false);
	}
	await expect(page.getByTestId('pwa-refresh-error')).toBeVisible();
	await changeArgs({ updateVersion: 'storybook-update-v3' });
	await expectPwaUpdateBanner(page, 'en', true, 'storybook-update-v3');
	await page.getByTestId('pwa-update-dismiss').click();
	await expectPwaUpdateBanner(page, 'en', false);
	await expect(page.getByTestId('pwa-refresh-error')).toBeVisible();
	await changeArgs({
		updateVersion: '',
		updateVersionError: 'Example waiting update identity could not be verified.'
	});
	await expect(page.getByTestId('pwa-update-banner')).toBeVisible();
	await expect(page.getByTestId('pwa-update-error')).toHaveText(
		'Example waiting update identity could not be verified.'
	);
	await expect(page.getByTestId('pwa-update-error')).toHaveAttribute(
		'role',
		'alert'
	);
	await expect(page.getByTestId('pwa-update-dismiss')).toBeDisabled();
	await expect(page.getByTestId('pwa-refresh-error')).toBeVisible();
	await changeArgs({
		updateVersion: 'storybook-update-v4',
		updateVersionError: ''
	});
	await expectPwaUpdateBanner(page, 'en', true, 'storybook-update-v4');
	await expect(page.getByTestId('pwa-update-error')).toHaveCount(0);

	expect(
		await page.evaluate(() =>
			sessionStorage.getItem('planit-dismissed-update-version')
		)
	).toBe('storybook-update-v2');
	expect(
		await page.evaluate(
			async () => (await navigator.serviceWorker.getRegistrations()).length
		)
	).toBe(0);
});

test('refresh failures preserve stored-data truth and one direct footer error', async ({
	page
}) => {
	test.setTimeout(60_000);
	for (const [width, language, theme, direction] of [
		[320, 'he', 'light', 'rtl'],
		[390, 'en', 'dark', 'ltr']
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		const text = pwaMessages[language];
		for (const state of [
			'cached-refresh-failure',
			'update-refresh-failure',
			'cached-refresh-shell-unavailable'
		]) {
			await page.goto(
				`${storyUrl(`components-pwastatus--${state}`)}&globals=language:${language};theme:${theme};direction:${direction}`
			);
			const root = page.getByTestId('pwa-status');
			const detail = page.getByTestId('pwa-status-details');
			await expect(root).toHaveAttribute(
				'data-state',
				state === 'cached-refresh-shell-unavailable' ? 'error' : 'ready'
			);
			await expect(root).toHaveAttribute('data-refresh-state', 'error');
			await expect(
				page.locator('details, summary, [role="dialog"]')
			).toHaveCount(0);
			await expect(root.getByRole('link')).toHaveCount(1);
			await expect(root.getByRole('link')).toHaveAttribute(
				'href',
				'#offline-status'
			);
			await expect(page.getByTestId('pwa-error')).toHaveCount(1);
			await expect(page.getByTestId('pwa-update-link')).toHaveCount(0);
			await expect(page.getByTestId('pwa-refresh-error')).toHaveText(
				text.cachedRefreshFailed
			);
			await expect(page.getByTestId('pwa-refresh-error')).toBeVisible();
			await expect(page.getByTestId('pwa-error-detail')).toHaveText(
				'Example course refresh failed: response validation rejected missing course names.'
			);
			await expect(page.getByTestId('pwa-error-detail')).toHaveAttribute(
				'dir',
				'auto'
			);
			await expect(page.getByTestId('pwa-incomplete')).toHaveCount(0);
			await expectPwaUpdateBanner(
				page,
				language,
				state === 'update-refresh-failure'
			);
			await expectPwaFooter(page);
			await expect(
				page.getByTestId('pwa-footer-row').getByTestId('pwa-status-details')
			).toHaveCount(1);
			const bounds = await detail.boundingBox();
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
			await page.screenshot({
				path: test.info().outputPath(`pwa-${state}-${width}.png`),
				fullPage: true
			});
			const retry = root.getByRole('button', { name: /^(Retry|נסו שוב)$/ });
			await expectCompactAction(retry);
			await retry.click();
			await expect(page.getByText('Retry requests: 1')).toBeVisible();
			// A retry request does not dismiss a real failure or hide a pending update.
			await expect(root).toHaveAttribute('data-refresh-state', 'error');
			await expect(page.getByTestId('pwa-refresh-error')).toBeVisible();
			await expectPwaUpdateBanner(
				page,
				language,
				state === 'update-refresh-failure'
			);
		}
	}
});

test('account-status presentation covers loading, retry, sign-out and offline guards', async ({
	page
}) => {
	await page.goto(storyUrl('components-consoleaccountstatus--auth-pending'));
	await expect(page.getByRole('status')).toContainText('Loading');
	await page.goto(
		storyUrl('components-consoleaccountstatus--account-unavailable')
	);
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByText('Retry requests: 1')).toBeVisible();
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page.getByText('Sign-out requests: 1')).toBeVisible();
	await page.goto(
		storyUrl('components-consoleaccountstatus--offline-account-unavailable')
	);
	await expect(page.getByTestId('plan-read-only')).toHaveCSS(
		'position',
		'absolute'
	);
	await expect(page.getByRole('button', { name: 'Try again' })).toBeDisabled();
	await expect(page.getByTestId('pwa-account-unavailable')).toBeVisible();
	for (const state of ['ready', 'offline']) {
		const id = `components-consoleaccountstatus--${state}`;
		await page.goto(storyUrl(id));
		await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
			'data-story-rendered',
			id
		);
		expect(
			await page
				.getByTestId('account-preview-slot')
				.evaluate((el) => el.getBoundingClientRect().height)
		).toBe(0);
		if (state === 'offline') {
			await expect(page.getByRole('status')).toContainText('Offline');
			await expect(page.getByRole('status')).toHaveCSS('position', 'absolute');
		}
	}
});

test('degree path and recommendation variants show their real controls', async ({
	page
}) => {
	await page.goto(storyUrl('components-degreesection--with-paths'));
	await expect(page.getByRole('combobox')).toHaveCount(4);
	await expect(page.locator('option[value="example-path"]')).toHaveText(
		'Example path'
	);
	await page.goto(storyUrl('components-degreesection--selected-path'));
	await expect(page.getByRole('combobox').last()).toHaveValue('example-path');
	await page.goto(storyUrl('components-degreesection--recommended'));
	await page.getByRole('button', { name: 'Revert to recommended' }).click();
	await expect(page.getByText('Demo reset requested')).toBeVisible();
	await page.goto(storyUrl('pages-catalog--no-degree'));
	await expect(
		page.getByRole('link', { name: /Select degree/i })
	).toHaveAttribute('href', '/app/settings');
});

test('filters stay visible above three-column mobile search results', async ({
	page
}) => {
	test.setTimeout(120_000);
	await page.goto(storyUrl('components-searchfilters--selected'));
	await expect(page.locator('.search-filters')).toBeVisible();
	await expect(
		page.locator('details.search-filters, .search-filters summary')
	).toHaveCount(0);
	await expect(page.locator('#search-faculty')).toBeVisible();
	await expect(page.locator('#search-faculty')).toHaveValue('Example science');
	await expect(page.locator('#search-points-min-input')).toHaveValue('2.0');
	await page.getByRole('button', { name: 'Clear filters' }).click();
	await expect(page.locator('#search-faculty')).toHaveValue('');
	await expect(page.locator('#search-points-min-input')).toHaveValue('0.0');
	await expect(page.locator('#search-faculty')).toBeVisible();
	await page.goto(storyUrl('pages-search--results'));
	await expect(page.locator('#search-faculty')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(
		page.locator('details.search-filters, .search-filters summary')
	).toHaveCount(0);
	const positions = await page.evaluate(() => ({
		filtersBottom: document
			.querySelector('.search-filters')!
			.getBoundingClientRect().bottom,
		headingTop: document
			.querySelector('.search-heading')!
			.getBoundingClientRect().top,
		headingBottom: document
			.querySelector('.search-heading')!
			.getBoundingClientRect().bottom,
		firstResult: document
			.querySelector('.search-results > li')!
			.getBoundingClientRect().top
	}));
	expect(positions.filtersBottom).toBeLessThanOrEqual(positions.headingTop);
	expect(positions.headingBottom).toBeLessThanOrEqual(positions.firstResult);
	for (const width of [320, 390]) {
		for (const direction of ['ltr', 'rtl']) {
			await page.setViewportSize({ width, height: 800 });
			await page.goto(
				`${storyUrl('pages-search--results')}&globals=language:${direction === 'rtl' ? 'he' : 'en'};direction:${direction};theme:${direction === 'rtl' ? 'dark' : 'light'}`
			);
			await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
				'data-story-rendered',
				'pages-search--results',
				{ timeout: 15_000 }
			);
			await expect(page.locator('#search-faculty')).toBeVisible();
			const results = page.locator('.search-results');
			await expect(results.locator(':scope > li')).toHaveCount(3);
			await expect(results).toHaveCSS('display', 'grid');
			const geometry = await results.evaluate((root) => {
				const bounds = root.getBoundingClientRect();
				const boxes = [...root.querySelectorAll(':scope > li')].map((el) => {
					const { left, right, top, width } = el.getBoundingClientRect();
					return { left, right, top, width };
				});
				return {
					columns: getComputedStyle(root)
						.gridTemplateColumns.split(' ')
						.map(parseFloat),
					left: bounds.left,
					right: bounds.right,
					boxes,
					overflow: root.scrollWidth - root.clientWidth,
					pageOverflow:
						document.documentElement.scrollWidth -
						document.documentElement.clientWidth
				};
			});
			expect(geometry.columns).toHaveLength(3);
			expect(
				Math.max(...geometry.columns) - Math.min(...geometry.columns)
			).toBeLessThanOrEqual(0.1);
			for (const box of geometry.boxes) {
				expect(box.width).toBeCloseTo(geometry.columns[0], 1);
				expect(box.top).toBeCloseTo(geometry.boxes[0].top, 1);
				expect(box.left).toBeGreaterThanOrEqual(geometry.left - 0.5);
				expect(box.right).toBeLessThanOrEqual(geometry.right + 0.5);
			}
			expect(geometry.overflow).toBe(0);
			expect(geometry.pageOverflow).toBe(0);
			for (const card of await results.locator('.course-card').all()) {
				await expect(card.locator('.course-body-squeezed')).toHaveCount(0);
				await expectOriginalCardHierarchy(card);
			}
			await results.scrollIntoViewIfNeeded();
			await page.screenshot({
				path: test
					.info()
					.outputPath(`search-three-columns-${width}-${direction}.png`),
				fullPage: false
			});
		}
	}
});

test('console surfaces remain readable and usable at narrow and wide widths', async ({
	page
}) => {
	test.setTimeout(180_000);
	for (const [width, globals] of [
		[320, 'theme:light;language:he;direction:rtl'],
		[1180, 'theme:dark;language:en;direction:ltr']
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		for (const id of [
			'pages-settings--choose-degree',
			'pages-settings--empty-plan',
			'pages-settings--guest',
			'pages-settings--signed-in',
			'pages-settings--exemptions',
			'pages-course--default',
			'pages-course--missing-details',
			'pages-search--results',
			'pages-search--filtered-results',
			'pages-catalog--default',
			'pages-shared-plan--default'
		]) {
			await test.step(`${id} at ${width}`, async () => {
				await page.goto(`${storyUrl(id)}&globals=${globals}`);
				await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
					'data-story-rendered',
					id,
					{ timeout: 15_000 }
				);
				await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
				const overflow = await page.evaluate(
					() =>
						document.documentElement.scrollWidth -
						document.documentElement.clientWidth
				);
				expect(overflow).toBeLessThanOrEqual(1);
				if (id.startsWith('pages-settings--')) {
					const account = page.locator('.settings-page > .account-section');
					await expect(account).toBeVisible();
					await expect(
						page.locator('.settings-page > .page-heading')
					).toHaveCount(0);
					const title = page.locator('.settings-page > h1');
					await expect(title).toHaveText(width === 320 ? 'הגדרות' : 'Settings');
					await expect(title).toHaveClass(/\bsr-only\b/);
					await expect(title).toHaveCSS('position', 'absolute');
					await expect(title).toHaveCSS('width', '1px');
					await expect(title).toHaveCSS('height', '1px');
					await expect(title).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)');
					const positions = await page
						.locator('.settings-page')
						.evaluate((root) => ({
							accountFirst: root
								.querySelector('section')!
								.classList.contains('account-section'),
							contentTop:
								root.getBoundingClientRect().top +
								parseFloat(getComputedStyle(root).paddingTop) +
								parseFloat(getComputedStyle(root).borderTopWidth),
							accountTop: root
								.querySelector('.account-section')!
								.getBoundingClientRect().top,
							accountBottom: root
								.querySelector('.account-section')!
								.getBoundingClientRect().bottom,
							degreeTop: root
								.querySelector('.degree-section')!
								.getBoundingClientRect().top
						}));
					expect(positions.accountFirst).toBe(true);
					expect(
						positions.accountTop,
						'account controls are the first visible settings row'
					).toBeCloseTo(positions.contentTop, 1);
					expect(positions.accountBottom).toBeLessThanOrEqual(
						positions.degreeTop
					);
					if (id === 'pages-settings--signed-in') {
						await expect(account.getByRole('heading')).toHaveCSS(
							'white-space',
							'normal'
						);
						await expect(account.getByRole('heading')).toHaveCSS(
							'overflow-wrap',
							'anywhere'
						);
						await expect(account.getByRole('heading')).toHaveText(
							'Example Student'
						);
						await expect(
							account.getByRole('button', { name: /^(Sign out|התנתק)$/ })
						).toBeVisible();
					} else {
						await expect(account.locator('img[alt="Google Logo"]')).toHaveCount(
							1
						);
						await expectSingleRenderedLine(account.getByRole('heading'));
					}
					for (const text of await page
						.locator(
							'.settings-field > span:not(.select-frame), .settings-field select, .settings-field option, .settings-field .no-path'
						)
						.all())
						await expect(text).toHaveCSS('font-size', '16px');
					if (id !== 'pages-settings--choose-degree') {
						const noPath = page.locator('.no-path');
						await expect(noPath).toBeVisible();
						await expect(noPath).toHaveText(
							width === 320 ? 'אין מסלולים בתואר' : 'Degree has no paths'
						);
						await expect(noPath).toHaveCSS('white-space', 'nowrap');
						const text = await noPath.evaluate((element) => {
							const range = document.createRange();
							range.selectNodeContents(element);
							const rects = [...range.getClientRects()].filter(
								(rect) => rect.width > 0
							);
							const bounds = element.getBoundingClientRect();
							return {
								lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
								fits: rects.every(
									(rect) =>
										rect.left >= bounds.left - 0.5 &&
										rect.right <= bounds.right + 0.5
								),
								overflow: element.scrollWidth - element.clientWidth
							};
						});
						expect(text).toEqual({ lines: 1, fits: true, overflow: 0 });
					}
					const sections = page.locator('.settings-page section');
					expect(await sections.count()).toBeGreaterThan(0);
					for (const section of await sections.all()) {
						await expect(section).toHaveCSS('border-top-width', '0px');
						await expect(section).toHaveCSS('border-bottom-width', '0px');
					}
				}
				if (id.startsWith('pages-search--')) {
					await expect(page.locator('#search-faculty')).toBeVisible();
					await expect(page.locator('#search-points-min-input')).toBeVisible();
					await expect(
						page.locator('details.search-filters, .search-filters summary')
					).toHaveCount(0);
					const filters = await page.locator('.search-filters').boundingBox();
					const heading = await page.locator('.search-heading').boundingBox();
					expect(filters!.y + filters!.height).toBeLessThanOrEqual(heading!.y);
				}
				if (id === 'pages-course--default') {
					const description = page.locator('p.course-description');
					await expect(description).toHaveText('A fictional follow-up course.');
					await expect(description).toBeVisible();
					await expect(page.locator('details.course-description')).toHaveCount(
						0
					);
					const about = await description.boundingBox();
					const actions = await page
						.getByTestId('course-plan-actions')
						.boundingBox();
					expect(about!.y + about!.height).toBeLessThanOrEqual(actions!.y);
				}
				if (id === 'pages-course--missing-details')
					await expect(page.locator('.course-description')).toHaveCount(0);

				if (
					[
						'pages-search--results',
						'pages-catalog--default',
						'pages-shared-plan--default'
					].includes(id)
				) {
					await expectOriginalCardHierarchy(
						page.locator('.course-card').first()
					);
				}
				for (const button of await page.locator('button.ui-button').all()) {
					if (await button.isVisible()) await expectCompactAction(button);
				}
				const controls = page.locator(
					'select, [data-testid="course-plan-actions"] button, .search-filters input[type="number"], .search-filters button'
				);
				for (const control of await controls.all()) {
					if (!(await control.isVisible())) continue;
					const dimensions = await control.evaluate((el) => ({
						height: el.getBoundingClientRect().height,
						minHeight: parseFloat(getComputedStyle(el).minHeight),
						fontSize: parseFloat(getComputedStyle(el).fontSize),
						isInput: el.matches('input, select')
					}));
					expect(dimensions.height).toBeGreaterThanOrEqual(35.5);
					// Editable fields stay compact with 16px text; action buttons are checked above.
					expect(dimensions.minHeight).toBeLessThanOrEqual(36);
					if (dimensions.isInput)
						expect(dimensions.fontSize).toBeGreaterThanOrEqual(16);
				}
				await page.screenshot({
					path: test.info().outputPath(`${id}-${width}.png`),
					fullPage: true
				});
			});
		}
	}
});

test('catalog scrollports fill the canvas with an internal logical card inset', async ({
	page
}) => {
	for (const width of [320, 390, 1440]) {
		for (const direction of ['rtl', 'ltr']) {
			await page.setViewportSize({ width, height: 800 });
			await page.goto(
				`${storyUrl('pages-catalog--default')}&globals=language:${direction === 'rtl' ? 'he' : 'en'};direction:${direction};theme:${direction === 'rtl' ? 'light' : 'dark'}`
			);
			await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
				'data-story-rendered',
				'pages-catalog--default',
				{ timeout: 15_000 }
			);
			const root = page.locator('.catalog-page');
			await expect(root).toHaveCSS('padding-left', '0px');
			await expect(root).toHaveCSS('padding-right', '0px');
			await expect(root).toHaveCSS('max-width', 'none');
			const canvas = await page.locator('[data-story-ready]').boundingBox();
			const bounds = await root.boundingBox();
			expect(bounds!.x).toBeCloseTo(canvas!.x, 1);
			expect(bounds!.width).toBeCloseTo(canvas!.width, 1);
			await expect(
				root.locator('.catalog-summary').getByRole('meter')
			).toHaveCount(2);
			await expect(
				root.locator('.catalog-section').getByRole('meter')
			).toHaveCount(0);
			await expect(root.getByRole('meter')).toHaveCount(2);
			await expectInlineCatalogMetrics(root, direction === 'rtl' ? 'he' : 'en');
			await expect(
				root.locator('.catalog-summary .catalog-values dd')
			).toHaveText(['1', '2', '4', '7']);
			const categoryMetrics = root.locator('.catalog-progress-panel');
			await expect(categoryMetrics).toHaveCount(2);
			await expect(
				categoryMetrics.first().locator('.catalog-values dd')
			).toHaveText(['1', '2', '2', '4', '7', '7']);
			await expect(
				categoryMetrics.last().locator('.catalog-values dd')
			).toHaveText(['0', '0', '1', '0', '0', '2']);
			for (const group of await categoryMetrics.all()) {
				await expect(group.locator('.catalog-metric-label')).toHaveCount(2);
				for (const label of await group
					.locator('.catalog-metric-label, dt')
					.all())
					await expect(label).not.toBeEmpty();
			}
			const rows = root.locator('.course-row');
			expect(await rows.count()).toBeGreaterThan(0);
			for (const row of await rows.all()) {
				const box = await row.boundingBox();
				expect(box!.x).toBeCloseTo(bounds!.x, 1);
				expect(box!.width).toBeCloseTo(bounds!.width, 1);
				const first = await row.locator('.course-card').first().boundingBox();
				expect(
					direction === 'rtl' ? first!.x + first!.width : first!.x
				).toBeCloseTo(
					direction === 'rtl' ? box!.x + box!.width - 12 : box!.x + 12,
					1
				);
			}
			await expectOriginalCardHierarchy(
				rows.first().locator('.course-card').first()
			);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth - innerWidth
				)
			).toBeLessThanOrEqual(1);
			await page.screenshot({
				path: test.info().outputPath(`catalog-edge-${width}-${direction}.png`),
				fullPage: true
			});
		}
	}
});

test('course cards retain metadata, full accessible names and visible codes below three-line clamps', async ({
	page
}) => {
	for (const direction of ['rtl', 'ltr']) {
		await page.setViewportSize({ width: 320, height: 800 });
		for (const state of ['default', 'compact', 'with-note', 'study-days']) {
			await page.goto(
				`${storyUrl(`components-courseelement--${state}`)}&globals=language:${direction === 'rtl' ? 'he' : 'en'};direction:${direction};theme:${direction === 'rtl' ? 'light' : 'dark'}`
			);
			const card = page.locator('.course-card');
			await expectOriginalCardHierarchy(card);
			await expect(card.locator('.course-median')).toContainText('86');
			await expect(card.locator('.course-points')).toContainText('4');
			if (state === 'with-note')
				await expect(card.locator('.course-meta .course-note')).toHaveText(
					'★ Example note'
				);
			if (state === 'study-days') {
				await expect(card.locator('.course-footer')).toBeVisible();
				const body = await card.locator('.course-body').boundingBox();
				const footer = await card.locator('.course-footer').boundingBox();
				expect(footer!.y).toBeGreaterThanOrEqual(body!.y + body!.height);
			}
		}
	}
});

test('course card body and requirement details are separate keyboard controls', async ({
	page
}) => {
	await page.goto(storyUrl('components-courseelement--interactive-warning'));
	const open = page.locator('.course-card button:not([aria-expanded])');
	const warning = page.getByRole('button', {
		name: 'Course requirement details'
	});
	await expect(warning).toHaveAttribute('aria-expanded', 'false');
	const warningBox = await warning.boundingBox();
	const cardBox = await page.locator('.course-card').boundingBox();
	expect(warningBox!.height).toBe(36);
	expect(warningBox!.width).toBeCloseTo(cardBox!.width, 1);
	expect(warningBox!.y).toBeGreaterThanOrEqual(
		(await open.boundingBox())!.y + (await open.boundingBox())!.height
	);
	await open.focus();
	await open.press('Enter');
	await expect(warning).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByText('Demo course opens: 0')).toBeVisible();
	await open.press('Enter');
	await expect(page.getByText('Demo course opens: 1')).toBeVisible();
	await warning.focus();
	await warning.press('Space');
	await expect(warning).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByText('Demo course opens: 1')).toBeVisible();
	await expect(
		page.locator('button button, button a, a button, a a')
	).toHaveCount(0);
});

test('semester strip shows exam-course count, mean median and credits without visible labels', async ({
	page
}) => {
	test.setTimeout(90_000);
	// The existing fixture has three courses: two have two exam sittings each,
	// and the third has no exams. The first metric must therefore be 2, not 3 or 4.
	const states = [
		{ id: 'default', values: ['2', '85.3', '9'], cards: 3 },
		{ id: 'excluded-from-summary', values: ['1', '85', '5'], cards: 3 },
		{ id: 'empty', values: ['0', '0', '0'], cards: 0 },
		{ id: 'loading', values: ['-', '-', '-'], cards: 3 }
	];
	for (const width of [320, 390]) {
		for (const language of ['en', 'he']) {
			await page.setViewportSize({ width, height: 800 });
			for (const state of states) {
				await page.goto(
					`${storyUrl(`components-semester--${state.id}`)}&globals=language:${language};theme:${language === 'he' ? 'dark' : 'light'}`
				);
				const summary = page.locator('.semester-summary');
				const selectors = [
					'.semester-tests',
					'.semester-median',
					'.semester-points'
				];
				const labels =
					language === 'he'
						? ['מבחנים', 'ממוצע חציונים', 'נקודות']
						: ['Tests', 'Average median', 'Points'];
				await expect(summary).toBeVisible();
				await expect(summary).toHaveCSS('flex-wrap', 'nowrap');
				for (const [index, selector] of selectors.entries()) {
					const metric = summary.locator(selector);
					await expect(summary.locator(':scope > span').nth(index)).toHaveClass(
						new RegExp(selector.slice(1))
					);
					await expect(metric).toHaveAttribute('title', labels[index]);
					await expect(metric.locator('.sr-only')).toHaveCSS(
						'position',
						'absolute'
					);
					await expect(metric.locator('.sr-only')).toHaveCSS('width', '1px');
					await expect(metric.locator('.sr-only')).toHaveCSS('height', '1px');
					await expect
						.poll(() =>
							metric.evaluate((element) => {
								const visible = element.cloneNode(true) as HTMLElement;
								visible
									.querySelectorAll('.sr-only')
									.forEach((node) => node.remove());
								return visible.textContent!.trim();
							})
						)
						.toBe(state.values[index]);
				}
				await expect(
					page.locator('.semester-courses .course-card')
				).toHaveCount(state.cards);
				const strip = await summary.evaluate((element) => {
					const bounds = element.getBoundingClientRect();
					return {
						left: bounds.left,
						right: bounds.right,
						top: bounds.top,
						bottom: bounds.bottom,
						overflow: element.scrollWidth - element.clientWidth,
						metrics: [...element.children].map((metric) => {
							const { left, right, top, bottom } =
								metric.getBoundingClientRect();
							return { left, right, top, bottom };
						})
					};
				});
				expect(strip.metrics).toHaveLength(3);
				expect(strip.overflow).toBeLessThanOrEqual(1);
				for (let index = 1; index < strip.metrics.length; index++) {
					const previous = strip.metrics[index - 1];
					const next = strip.metrics[index];
					expect(
						language === 'he'
							? previous.left - next.right
							: next.left - previous.right
					).toBeCloseTo(4, 1);
				}

				for (const metric of strip.metrics) {
					expect(metric.top).toBeCloseTo(strip.metrics[0].top, 1);
					expect(metric.bottom).toBeCloseTo(strip.metrics[0].bottom, 1);
					expect(metric.left).toBeGreaterThanOrEqual(strip.left - 0.5);
					expect(metric.right).toBeLessThanOrEqual(strip.right + 0.5);
				}
				expect(
					await page.evaluate(
						() => document.documentElement.scrollWidth - innerWidth
					)
				).toBeLessThanOrEqual(1);
				if (state.id === 'default')
					await page.screenshot({
						path: test
							.info()
							.outputPath(`semester-strip-${width}-${language}.png`),
						fullPage: false
					});
			}
		}
	}
});

test('compact planner rails show three full items and the next item at mobile widths', async ({
	page
}) => {
	for (const width of [320, 390]) {
		for (const direction of ['rtl', 'ltr']) {
			await page.setViewportSize({ width, height: 800 });
			const globals = `theme:${direction === 'rtl' ? 'light' : 'dark'};language:${direction === 'rtl' ? 'he' : 'en'};direction:${direction}`;
			await page.goto(
				`${storyUrl('pages-plan--long-plan')}&globals=${globals}`
			);
			await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
				'data-story-rendered',
				'pages-plan--long-plan',
				{ timeout: 15_000 }
			);
			const toolbar = page.locator('.plan-toolbar');
			const heading = toolbar.getByRole('heading', {
				name: direction === 'rtl' ? 'רשימת משאלות' : 'Wish list',
				exact: true
			});
			const share = toolbar.getByRole('link', {
				name: direction === 'rtl' ? 'שתף' : 'Share',
				exact: true
			});
			await expect(share).toHaveText(direction === 'rtl' ? 'שתף' : 'Share');
			await expect(share).toHaveCSS('padding-inline-start', '8px');
			await expect(share).toHaveCSS('padding-inline-end', '8px');
			await expect(share).toHaveCSS('color', 'rgb(255, 255, 255)');
			await expect(share).toHaveCSS('background-color', 'rgb(15, 111, 103)');
			await expectCompactAction(share);
			await expectSingleRenderedLine(share);
			await expect(heading).toHaveCSS('white-space', 'nowrap');
			await expectSingleRenderedLine(heading);
			const rails = [
				['wishlist-scroller', '[data-testid="plan-wishlist"] > [data-code]'],
				['semester-scroller', '[data-semester]']
			];
			for (const [rail, items] of rails) {
				await expectRailReadingEdge(page.getByTestId(rail), items, direction);
				await expect
					.poll(
						async () =>
							page.getByTestId(rail).evaluate((el, selector) => {
								const rail = el.getBoundingClientRect();
								const boxes = Array.from(
									el.querySelectorAll(selector),
									(item) => item.getBoundingClientRect()
								);
								return {
									full: boxes.filter(
										(box) =>
											box.left >= rail.left - 0.5 &&
											box.right <= rail.right + 0.5
									).length,
									peek: boxes.filter((box) => {
										const visible =
											Math.min(box.right, rail.right) -
											Math.max(box.left, rail.left);
										return visible >= 4 && visible < box.width - 1;
									}).length
								};
							}, items),
						{ message: `${rail} at ${width}px ${direction}` }
					)
					.toEqual({ full: 3, peek: 1 });
			}
			await expectOriginalCardHierarchy(
				page.getByTestId('plan-wishlist').locator('.course-card').first()
			);
			await expectNaturalRowHeight(page.getByTestId('plan-wishlist'));
			// Full-page capture resizes the viewport and can move transformed RTL rails.
			// Capture the real initial viewport before keyboard focus scrolls a semester.
			await page.screenshot({
				path: test.info().outputPath(`compact-plan-${width}-${direction}.png`),
				fullPage: false
			});
			for (const [rail, items] of rails)
				await expectRailReadingEdge(page.getByTestId(rail), items, direction);
			const exams = page.locator('.semester-exams');
			await expect(exams.locator('.study-days')).toBeVisible();
			await expect(exams.locator('.study-chip').first()).toBeVisible();
			await expect(
				page.locator('details.semester-exams, .semester-exams summary')
			).toHaveCount(0);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth - innerWidth
				)
			).toBeLessThanOrEqual(1);
		}
	}
});

test('course and catalog rails keep natural equal card heights and full canvas width while scrolling', async ({
	page
}) => {
	test.setTimeout(180_000);
	let clampedLongNames = 0;
	for (const width of [320, 390]) {
		for (const direction of ['rtl', 'ltr']) {
			await page.setViewportSize({ width, height: 800 });
			for (const id of [
				'pages-course--related-courses',
				'pages-catalog--long-wishlist',
				'pages-course--default',
				'pages-catalog--default'
			]) {
				await page.goto(
					`${storyUrl(id)}&globals=language:${direction === 'rtl' ? 'he' : 'en'};direction:${direction};theme:${direction === 'rtl' ? 'dark' : 'light'}`
				);
				await expect(page.locator('[data-story-rendered]')).toHaveAttribute(
					'data-story-rendered',
					id,
					{ timeout: 15_000 }
				);
				const root = page.locator(
					id.includes('catalog') ? '.catalog-page' : '.course-page'
				);
				const canvas = await page.locator('[data-story-ready]').boundingBox();
				const roots = await root.boundingBox();
				expect(roots!.x).toBeCloseTo(canvas!.x, 1);
				expect(roots!.width).toBeCloseTo(canvas!.width, 1);
				await expect(
					root.locator('.loading-course, .course-loading, .catalog-loading')
				).toHaveCount(0);
				await page.evaluate(() => document.fonts.ready);
				const rails = root.locator('.course-dependencies, .course-row');
				const overflowing = [];
				for (const [index, row] of (await rails.all()).entries()) {
					if (!(await row.locator('.course-card').count())) continue;
					await expectNaturalRowHeight(row);
					if (
						id.endsWith('--default') &&
						(await row.locator('.course-card').count()) > 1
					) {
						await row.scrollIntoViewIfNeeded();
						await page.screenshot({
							path: test
								.info()
								.outputPath(
									`${id}-${index}-${width}-${direction}-mixed-heights.png`
								),
							fullPage: false
						});
					}
				}
				for (const rail of await rails.all()) {
					if ((await rail.locator('.course-card').count()) >= 7)
						overflowing.push(rail);
				}
				expect(overflowing).toHaveLength(
					id.endsWith('--default') ? 0 : id.includes('catalog') ? 1 : 3
				);
				for (const [index, rail] of overflowing.entries()) {
					await rail.scrollIntoViewIfNeeded();
					await expect
						.poll(() => rail.evaluate((el) => Math.abs(el.scrollLeft)))
						.toBeLessThanOrEqual(1);
					const box = await rail.boundingBox();
					expect(box!.x).toBeCloseTo(canvas!.x, 1);
					expect(box!.width).toBeCloseTo(canvas!.width, 1);
					const first = await rail
						.locator('.course-card')
						.first()
						.boundingBox();
					expect(
						direction === 'rtl'
							? box!.x + box!.width - first!.x - first!.width
							: first!.x - box!.x
					).toBeCloseTo(12, 1);
					expect(first!.width).toBeCloseTo((width - 40) / 3.25, 1);
					for (const card of await rail.locator('.course-card').all()) {
						await expectOriginalCardHierarchy(card);
						const name = card.locator('.course-name');
						if (
							await name.evaluate(
								(element) => element.scrollHeight > element.clientHeight + 1
							)
						)
							clampedLongNames++;
					}
					await page.screenshot({
						path: test
							.info()
							.outputPath(`${id}-${index}-${width}-${direction}-initial.png`),
						fullPage: false
					});
					for (const fraction of [0.5, 1]) {
						await rail.evaluate(
							(el, { fraction, direction }) => {
								el.scrollLeft =
									(direction === 'rtl' ? -1 : 1) *
									fraction *
									(el.scrollWidth - el.clientWidth);
							},
							{ fraction, direction }
						);
						await expect
							.poll(() =>
								rail.evaluate(
									(el) =>
										Math.abs(el.scrollLeft) / (el.scrollWidth - el.clientWidth)
								)
							)
							.toBeCloseTo(fraction, 2);
						const position = await rail.boundingBox();
						expect(position!.x).toBeCloseTo(canvas!.x, 1);
						expect(position!.width).toBeCloseTo(canvas!.width, 1);
						expect(
							await page.evaluate(
								() => document.documentElement.scrollWidth - innerWidth
							)
						).toBeLessThanOrEqual(1);
					}
					const last = await rail.locator('.course-card').last().boundingBox();
					expect(last!.x).toBeGreaterThanOrEqual(box!.x - 1);
					expect(last!.x + last!.width).toBeLessThanOrEqual(
						box!.x + box!.width + 1
					);
					await page.screenshot({
						path: test
							.info()
							.outputPath(`${id}-${index}-${width}-${direction}-end.png`),
						fullPage: false
					});
					const before = page.url();
					await rail.locator('a[href^="/app/course/"]').last().click();
					expect(page.url()).toBe(before); // The story's navigation stays mocked.
				}
			}
		}
	}
	// The approved five-line name reserve can equalize short and long cards.
	// Row shells still match their own tallest intrinsic content, including code.
	expect(
		clampedLongNames,
		'long fixture names exercise real three-line clipping'
	).toBeGreaterThan(0);
});
