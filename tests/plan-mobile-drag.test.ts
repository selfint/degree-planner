import { devices, expect, test } from '@playwright/test';

const { defaultBrowserType: _, ...mobile } = devices['Pixel 7'];
test.use(mobile);

const courses = {
	'10400001': { code: '10400001', name: 'First course', points: 5 },
	'10400002': { code: '10400002', name: 'Second course', points: 5 },
	'10400003': { code: '10400003', name: 'Wishlist course', points: 5 }
};

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('lang', 'en');
		localStorage.setItem('version', '4');
		localStorage.setItem(
			'userData',
			JSON.stringify({
				exemptions: [],
				semesters: [['10400001', '10400002'], [], [], [], [], []],
				currentSemester: 0,
				wishlist: ['10400003']
			})
		);
	});
	await page.route('**/courseDataStripped.json', (route) =>
		route.fulfill({ json: courses })
	);
	await page.goto('/plan');
	await expect(page.getByText('First course')).toBeVisible();
});

test('touch drag stays under the finger when leaving the semester scroller', async ({
	page,
	context
}) => {
	const card = page.locator('[data-code="10400001"]');
	const box = (await card.boundingBox())!;
	const start = {
		x: Math.round(box.x + box.width / 2),
		y: Math.round(box.y + box.height / 2)
	};
	const touch = await context.newCDPSession(page);
	await touch.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [start]
	});
	// Sortable starts touch drags after its long-press delay.
	await page.waitForTimeout(200);
	await touch.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [{ x: start.x, y: start.y - 5 }]
	});
	const ghost = page.locator('.sortable-fallback');
	await expect(ghost).toBeVisible();

	for (const offset of [-30, -70, -120, -50, -100]) {
		const point = { x: start.x + 20, y: start.y + offset };
		await touch.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [point]
		});
		await expect
			.poll(async () => {
				const rect = (await ghost.boundingBox())!;
				return Math.abs(rect.y + rect.height / 2 - point.y);
			})
			.toBeLessThan(3);
		await expect
			.poll(async () => {
				const rect = (await ghost.boundingBox())!;
				return Math.abs(rect.x + rect.width / 2 - point.x);
			})
			.toBeLessThan(3);
	}
	await touch.send('Input.dispatchTouchEvent', {
		type: 'touchEnd',
		touchPoints: []
	});
	await expect(ghost).toHaveCount(0);
	await expect(page.locator('[data-code="10400001"]')).toHaveCount(1);
	await expect(page).toHaveURL(/\/plan$/);
});
