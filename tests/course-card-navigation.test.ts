import { expect, test, type Locator, type Page } from '@playwright/test';

const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const codes = ['10400001', '10400002', '10400003', '10400004'];
const courses = Object.fromEntries(
	codes.map((code, index) => [
		code,
		{
			code,
			name: `Navigation course ${index + 1}`,
			faculty: 'Navigation faculty',
			points: 5,
			median: 80,
			current: true,
			// Identical layout and one dependency per page intentionally exercise
			// Svelte's related-card DOM reuse at the previously tapped position.
			connections: {
				dependencies: [[codes[(index + 1) % codes.length]]],
				adjacent: [],
				exclusive: []
			}
		}
	])
);

async function openFixture(page: Page, language = 'en') {
	await page.addInitScript((language) => {
		localStorage.setItem('lang', language);
		localStorage.setItem('version', '4');
		localStorage.setItem(
			'userData',
			JSON.stringify({
				semesters: [[]],
				currentSemester: 0,
				exemptions: [],
				wishlist: []
			})
		);
	}, language);
	await page.route(/\/courseData(?:Stripped)?\.json(?:\?.*)?$/, (route) =>
		route.fulfill({ json: courses })
	);
	await page.route(/\/_courses\/1040000[1-4](?:\?.*)?$/, (route) => {
		const code = new URL(route.request().url()).pathname.split('/').at(-1)!;
		return route.fulfill({ json: courses[code] });
	});
	await page.goto(`${origin}/app/course/${codes[0]}`);
	await expectCourse(page, 0);
}

function dependencyLink(page: Page) {
	return page.locator('.course-dependencies a').first();
}

async function expectCourse(page: Page, index: number) {
	await expect(page).toHaveURL(`${origin}/app/course/${codes[index]}`);
	await expect(page.locator('h1.course-name')).toHaveText(
		courses[codes[index]].name
	);
	await expect(dependencyLink(page)).toHaveAttribute(
		'href',
		`/app/course/${codes[(index + 1) % codes.length]}`
	);
	// Wait for the reused CourseElement's async content too, not only the URL.
	await expect(dependencyLink(page).locator('.course-name')).toHaveText(
		courses[codes[(index + 1) % codes.length]].name
	);
}

async function cardState(link: Locator) {
	return link.evaluate((element) => {
		const card = element.querySelector('.course-card')!;
		const style = getComputedStyle(card);
		const focused = document.activeElement;
		return {
			href: element.getAttribute('href'),
			shadow: style.boxShadow,
			background: style.backgroundColor,
			hover: card.matches(':hover'),
			focus: element === focused,
			focusVisible: element.matches(':focus-visible'),
			focusedTag: focused?.tagName,
			focusedHref: focused?.getAttribute('href'),
			reusedFrom: element.getAttribute('data-navigation-probe'),
			top: element.getBoundingClientRect().top
		};
	});
}

test.describe('touch related-course navigation', () => {
	test.use({
		viewport: { width: 390, height: 664 },
		isMobile: true,
		hasTouch: true
	});

	for (const language of ['en', 'he']) {
		test(`repeated related-course taps leave no highlighted card (${language})`, async ({
			page
		}, testInfo) => {
			await openFixture(page, language);
			expect(
				await page.evaluate(() => matchMedia('(hover: hover)').matches)
			).toBe(false);
			expect(
				await page.evaluate(() => matchMedia('(pointer: fine)').matches)
			).toBe(false);
			const timeOrigin = await page.evaluate(() => performance.timeOrigin);
			const resting = await cardState(dependencyLink(page));
			const states = [resting];
			try {
				for (let index = 1; index < codes.length; index++) {
					const link = dependencyLink(page);
					await link.evaluate(
						(element, previous) => {
							element.setAttribute('data-navigation-probe', previous);
						},
						codes[index - 1]
					);
					// A native touch gesture, not a mouse click or dispatched DOM event.
					await link.tap();
					await expectCourse(page, index);
					const next = dependencyLink(page);
					states.push(await cardState(next));
					// Touch engines may retain :hover on the reused element. Compare the
					// actual decoration, rather than requiring that browser state vanish.
					await expect(next.locator('.course-card')).toHaveCSS(
						'box-shadow',
						resting.shadow
					);
					await expect(next.locator('.course-card')).toHaveCSS(
						'background-color',
						resting.background
					);
					expect((await cardState(next)).focusVisible).toBe(false);
					expect(await page.evaluate(() => performance.timeOrigin)).toBe(
						timeOrigin
					);
				}
			} finally {
				await testInfo.attach('related-course-touch-state', {
					body: JSON.stringify(states, null, 2),
					contentType: 'application/json'
				});
			}
		});
	}
});

async function tabTo(page: Page, target: Locator) {
	// Exercise the actual tab order rather than installing focus with evaluate().
	for (let step = 0; step < 30; step++) {
		await page.keyboard.press('Tab');
		if (await target.evaluate((element) => element === document.activeElement))
			return;
	}
	throw new Error('Related course was not reachable within 30 Tab presses.');
}

test.describe('keyboard related-course navigation', () => {
	// Also overrides the mobile project's context for real desktop keyboard input.
	test.use({
		viewport: { width: 1180, height: 800 },
		isMobile: false,
		hasTouch: false
	});

	test('Tab and Enter retain visible focus through repeated related courses', async ({
		page
	}) => {
		await openFixture(page);
		const timeOrigin = await page.evaluate(() => performance.timeOrigin);
		for (let index = 1; index < codes.length; index++) {
			const link = dependencyLink(page);
			await tabTo(page, link);
			await expect(link).toBeFocused();
			const focus = await link.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					visible: element.matches(':focus-visible'),
					style: style.outlineStyle,
					width: parseFloat(style.outlineWidth),
					color: style.outlineColor
				};
			});
			expect(focus.visible).toBe(true);
			expect(focus.style).toBe('solid');
			expect(focus.width).toBeGreaterThanOrEqual(2);
			expect(focus.color).not.toBe('rgba(0, 0, 0, 0)');
			await page.keyboard.press('Enter');
			await expectCourse(page, index);
			expect(await page.evaluate(() => performance.timeOrigin)).toBe(
				timeOrigin
			);
		}
	});
});
