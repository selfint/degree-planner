import { expect, test as base } from '@playwright/test';

const test = base.extend<{
	courseName: string;
	language: 'en' | 'he';
	theme: 'light' | 'dark';
}>({
	courseName: ['Advanced course', { option: true }],
	language: ['en', { option: true }],
	theme: ['light', { option: true }]
});

const courses = {
	'10400001': {
		code: '10400001',
		name: 'Advanced course',
		median: 82,
		points: 5,
		connections: { dependencies: [['10400002']] }
	},
	'10400002': {
		code: '10400002',
		name: 'Prerequisite course',
		points: 5
	},
	'10400003': {
		code: '10400003',
		name: 'Wishlist course',
		points: 5
	}
};

test.beforeEach(async ({ page, courseName, language, theme }) => {
	await page.addInitScript(
		({ language, theme }) => {
			localStorage.setItem('theme', theme);
			localStorage.setItem('lang', language);
			localStorage.setItem('version', '4');
			localStorage.setItem(
				'userData',
				JSON.stringify({
					exemptions: [],
					semesters: [['10400001', '10400002']],
					currentSemester: 0,
					wishlist: ['10400003']
				})
			);
		},
		{ language, theme }
	);
	// Startup now syncs the canonical full dataset; both views use this fixture.
	await page.route(/\/courseData(?:Stripped)?\.json(?:\?.*)?$/, (route) =>
		route.fulfill({
			json: {
				...courses,
				'10400001': { ...courses['10400001'], name: courseName }
			}
		})
	);
	// Hydration otherwise reuses the real course data embedded by server rendering.
	await page.route('**/app/plan', async (route) => {
		const response = await route.fetch();
		const body = (await response.text()).replace(
			/<script[^>]*data-sveltekit-fetched[^>]*data-url="\/courseDataStripped\.json"[^>]*>.*?<\/script>/s,
			''
		);
		await route.fulfill({ response, body });
	});
	await page.goto('/app/plan');
});

test('course dependencies start closed and can be opened and closed repeatedly', async ({
	page
}) => {
	const card = page.locator('[data-code="10400001"]');
	const toggle = card.locator('button[aria-expanded]');
	const dependencies = card.getByRole('heading', { name: 'Dependencies' });

	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(dependencies).not.toBeVisible();

	for (let i = 0; i < 2; i++) {
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(dependencies).toBeVisible();
		await expect(card.getByText('Prerequisite course')).toBeVisible();
		await expect(page).toHaveURL(/\/app\/plan$/);

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(dependencies).not.toBeVisible();
	}

	// The existing whole-card shortcut still opens a collapsed warning.
	await card.getByText('Advanced course').click();
	await expect(dependencies).toBeVisible();
	await expect(page).toHaveURL(/\/app\/plan$/);

	await page.reload();
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(dependencies).not.toBeVisible();
});

test('a planned course without warnings still opens on the first click', async ({
	page
}) => {
	const card = page.locator('[data-code="10400002"]');
	await expect(card.getByText('Prerequisite course')).toBeVisible();
	await expect(card.locator('button[aria-expanded]')).toHaveCount(0);
	await card.getByText('Prerequisite course').click();
	await expect(page).toHaveURL(/\/app\/course\/10400002$/);
});

test('a wishlist course still opens on the first click', async ({ page }) => {
	await page.locator('[data-code="10400003"]').click();
	await expect(page).toHaveURL(/\/app\/course\/10400003$/);
});

test('planned course navigation and warnings are separate keyboard controls', async ({
	page
}) => {
	const card = page.locator('[data-code="10400001"]');
	await expect(card.locator('button button, a button, button a')).toHaveCount(
		0
	);
	const toggle = card.getByRole('button', {
		name: 'Course requirement details',
		exact: true
	});
	await toggle.focus();
	await page.keyboard.press('Enter');
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(
		card.getByRole('heading', { name: 'Dependencies' })
	).toBeVisible();
	await page.keyboard.press('Space');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	const open = card.locator('.course-open');
	await open.focus();
	await page.keyboard.press('Enter');
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(page).toHaveURL(/\/app\/plan$/);
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/app\/course\/10400001$/);
});

for (const width of [320, 390]) {
	test(`original card hierarchy keeps metadata above clamped name and visible code with a separate warning below (${width}px)`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 568 });
		const card = page.locator('[data-code="10400001"]');
		const toggle = card.getByRole('button', {
			name: 'Course requirement details',
			exact: true
		});
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await card.scrollIntoViewIfNeeded();
		const meta = (await card.locator('.course-meta').boundingBox())!;
		const copy = (await card.locator('.course-copy').boundingBox())!;
		const code = (await card.locator('.course-code').boundingBox())!;
		const body = (await card.locator('.course-body').boundingBox())!;
		const warning = (await toggle.boundingBox())!;
		expect(warning.width).toBeGreaterThanOrEqual(36);
		expect(warning.height).toBeGreaterThanOrEqual(36);
		expect(code.y + code.height).toBeLessThanOrEqual(warning.y + 1);
		expect(meta.y + meta.height).toBeLessThanOrEqual(copy.y);
		expect(warning.y).toBeGreaterThanOrEqual(body.y + body.height);
		expect(warning.width).toBeCloseTo(body.width, 0);
		await expect(card.locator('.course-meta .course-median')).toContainText(
			'82'
		);
		await expect(card.locator('.course-meta .course-points')).toContainText(
			'5'
		);
		await expect(card.locator('.course-copy > .course-name')).toHaveCSS(
			'-webkit-line-clamp',
			'3'
		);
		await expect(card.locator('.course-copy > .course-code')).toHaveCSS(
			'display',
			'inline-block'
		);
		await expect(card.locator('.course-name')).toHaveAttribute(
			'title',
			'Advanced course'
		);
		await expect(card.locator('button button')).toHaveCount(0);
		await toggle.focus();
		await page.keyboard.press('Enter');
		await expect(
			card.getByRole('heading', { name: 'Dependencies' })
		).toBeVisible();
		await page.keyboard.press('Space');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	});
}

const longNames = {
	en: 'Advanced computational methods for multidisciplinary systems analysis and mathematical research with practical applications',
	he: 'שיטות חישוביות מתקדמות לניתוח מערכות רב תחומיות ומחקר מתמטי עם יישומים מעשיים במדעי המחשב'
};
for (const width of [320, 390]) {
	for (const language of ['en', 'he'] as const) {
		test.describe(`long ${language} course name at ${width}px`, () => {
			test.use({
				viewport: { width, height: 568 },
				language,
				courseName: longNames[language]
			});
			test('clamps only the visible name, preserves squeezed height, and retains full accessible text', async ({
				page,
				courseName
			}) => {
				const card = page.locator('[data-code="10400001"]');
				const name = card.locator('.course-name');
				const code = card.locator('.course-code');
				await expect(name).toHaveText(courseName);
				await expect(name).toHaveAttribute('title', courseName);
				await expect(card.locator('.course-open')).toHaveAccessibleName(
					new RegExp(courseName)
				);
				await expect(card.locator('.course-copy')).toHaveCSS(
					'min-block-size',
					'0px'
				);
				await expect(code).toHaveText('10400001');
				await expect(code).toHaveAttribute('dir', 'ltr');
				await expect(name).toHaveCSS('-webkit-line-clamp', '3');
				await expect(name).toHaveCSS('-webkit-box-orient', 'vertical');
				await expect(name).toHaveCSS('overflow', 'hidden');
				await expect(name).toHaveCSS('font-size', '12px');
				await expect(name).toHaveCSS('line-height', '12px');
				await expect(code).toHaveCSS('font-size', '12px');
				await expect(code).toHaveCSS('line-height', '12px');
				await expect(card.locator('.course-meta')).toHaveCSS(
					'font-size',
					'12px'
				);
				await expect(card.locator('.course-meta')).toHaveCSS(
					'line-height',
					'16px'
				);
				await page.evaluate(() => document.fonts.ready);
				const geometry = await card.evaluate((card) => {
					const name = card.querySelector<HTMLElement>('.course-name')!;
					const copy = card
						.querySelector('.course-copy')!
						.getBoundingClientRect();
					const code = card
						.querySelector('.course-code')!
						.getBoundingClientRect();
					const bounds = name.getBoundingClientRect();
					return {
						viewport: innerWidth,
						overflow: document.documentElement.scrollWidth - innerWidth,
						nameHeight: bounds.height,
						fullNameHeight: name.scrollHeight,
						copyHeight: copy.height,
						codeStart: code.top - copy.top,
						codeAfterName: code.top >= bounds.bottom,
						codeFits:
							code.left >= copy.left &&
							code.right <= copy.right &&
							code.bottom <= copy.bottom
					};
				});
				expect(geometry.viewport).toBe(width);
				expect(geometry.overflow).toBeLessThanOrEqual(1);
				expect(geometry.nameHeight).toBe(36);
				expect(geometry.fullNameHeight).toBeGreaterThan(geometry.nameHeight);
				expect(geometry.copyHeight).toBe(48);
				expect(geometry.codeStart).toBe(36);
				expect(geometry.codeAfterName).toBe(true);
				expect(geometry.codeFits).toBe(true);
			});
		});
	}
}

for (const width of [390, 1280]) {
	for (const language of ['en', 'he'] as const) {
		for (const theme of ['light', 'dark'] as const) {
			test.describe(`inline short card ${language} ${theme} ${width}px`, () => {
				test.use({
					viewport: { width, height: 844 },
					language,
					theme,
					courseName: language === 'en' ? 'Math' : 'חשבון'
				});
				test('places the number directly after the short name and scales the metadata marker', async ({
					page
				}, info) => {
					const card = page.locator('[data-code="10400001"]');
					await expect(card.locator('.course-name')).toBeVisible();
					await page.evaluate(() => document.fonts.ready);
					const geometry = await card.evaluate((card) => {
						const name = card
							.querySelector('.course-name')!
							.getBoundingClientRect();
						const code = card
							.querySelector('.course-code')!
							.getBoundingClientRect();
						const meta = card.querySelector('.course-meta')!;
						const marker = card
							.querySelector('.course-marker')!
							.getBoundingClientRect();
						const stats = card
							.querySelector('.course-stats')!
							.getBoundingClientRect();
						return {
							name: {
								top: name.top,
								bottom: name.bottom,
								left: name.left,
								right: name.right
							},
							code: {
								top: code.top,
								bottom: code.bottom,
								left: code.left,
								right: code.right
							},
							markerHeight: marker.height,
							metadataFont: parseFloat(getComputedStyle(meta).fontSize),
							markerCenter: (marker.top + marker.bottom) / 2,
							statsCenter: (stats.top + stats.bottom) / 2,
							rtl:
								getComputedStyle(card.querySelector('.course-copy')!)
									.direction === 'rtl'
						};
					});
					// Mobile cards may naturally wrap the unbroken number. There is no reserved gap.
					expect(geometry.code.top).toBeGreaterThanOrEqual(
						geometry.name.top - 0.5
					);
					expect(geometry.code.top).toBeLessThanOrEqual(
						geometry.name.bottom + 0.5
					);
					if (width === 1280) {
						expect(geometry.code.top).toBeCloseTo(geometry.name.top, 1);
						const gap = geometry.rtl
							? geometry.name.left - geometry.code.right
							: geometry.code.left - geometry.name.right;
						expect(gap).toBeGreaterThanOrEqual(0);
						expect(gap).toBeLessThanOrEqual(4);
					}
					expect(geometry.markerHeight).toBe(geometry.metadataFont);
					expect(geometry.markerCenter).toBeCloseTo(geometry.statsCenter, 1);
					await page.screenshot({
						path: info.outputPath('inline-course-card.png'),
						fullPage: true
					});
				});
			});
		}
	}
}
