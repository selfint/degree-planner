import { expect, test } from '@playwright/test';

const origin = 'http://localhost:4173';
const degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];
const programUrl = `/_catalogs/${degree.join('/')}/requirementsData.json`;

for (const language of ['en', 'he']) {
	test(`existing preview links render their degree and path in ${language} using only JSON`, async ({
		page,
		request
	}) => {
		const savedPlan = {
			degree,
			path: 'CG00006253',
			exemptions: ['00104031'],
			semesters: [['00234114'], []],
			currentSemester: 1,
			wishlist: ['00234124']
		};
		await page.addInitScript(
			({ language, savedPlan }) => {
				localStorage.setItem('lang', language);
				localStorage.setItem('version', '4');
				localStorage.setItem('userData', JSON.stringify(savedPlan));
			},
			{ language, savedPlan }
		);
		const legacyRequests: string[] = [];
		page.on('request', (request) => {
			const pathname = new URL(request.url()).pathname;
			if (
				pathname.startsWith('/_catalogs/') &&
				!pathname.endsWith('/requirementsData.json')
			) {
				legacyRequests.push(pathname);
			}
		});
		const response = await request.get(origin + programUrl);
		expect(response.ok()).toBe(true);
		const requirement = await response.json();
		const selectedPath = requirement.nested.find(
			(node: { name: string }) => node.name === 'CG00006253'
		);
		await page.goto(
			`${origin}/app/preview/${degree.join('/')}?path=CG00006253&semesters=00234114~00104031`
		);
		await expect(page.locator('main h1').first()).toContainText(
			selectedPath[language]
		);
		await expect(page.locator('main h1').first()).toContainText(
			requirement[language]
		);
		expect(legacyRequests).toEqual([]);
		expect(
			await page.evaluate(() => JSON.parse(localStorage.getItem('userData')!))
		).toEqual(savedPlan);
	});
}
