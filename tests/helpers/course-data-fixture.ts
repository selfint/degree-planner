import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

/** Keep cold snapshot reads and later canonical refreshes on the same fixture. */
export async function mockCourseData(page: Page, courses: unknown) {
	const body = JSON.stringify(courses);
	const snapshotPath = `/_data/${createHash('sha256').update(body).digest('hex')}.json`;
	let snapshotReads = 0;
	await page.route('**/_data/manifest.json', async (route) => {
		const response = await route.fetch();
		const manifest = await response.json();
		await route.fulfill({
			json: {
				...manifest,
				'/courseData.json': {
					url: snapshotPath,
					bytes: Buffer.byteLength(body)
				}
			}
		});
	});
	await page.route(`**${snapshotPath}`, (route) => {
		snapshotReads++;
		return route.fulfill({ contentType: 'application/json', body });
	});
	await page.route(/\/courseData(?:Stripped)?\.json(?:\?.*)?$/, (route) =>
		route.fulfill({ contentType: 'application/json', body })
	);
	return () => snapshotReads;
}
