import { defineConfig } from '@playwright/test';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
if (process.env.RECORD_STUDENT_JOURNEYS !== '1')
	throw new Error(
		'Set RECORD_STUDENT_JOURNEYS=1 for the capture-only configuration'
	);
export default defineConfig({
	testDir: 'tests',
	testMatch: 'student-journeys.test.ts',
	outputDir: 'test-results/journeys-checks',
	workers: 1,
	retries: 0,
	timeout: 180_000,
	use: {
		baseURL,
		browserName: 'chromium',
		viewport: { width: 960, height: 720 },
		video: { mode: 'on', size: { width: 960, height: 720 } },
		serviceWorkers: 'block',
		trace: 'on',
		launchOptions: { slowMo: 0 }
	},
	projects: ['light', 'dark'].map((theme) => ({
		name: `journey-${theme}`,
		use: { colorScheme: theme as 'light' | 'dark' }
	})),
	webServer: process.env.PLAYWRIGHT_BASE_URL
		? undefined
		: {
				command: 'npm run build && npm run preview',
				url: baseURL,
				timeout: 180_000,
				reuseExistingServer: !process.env.CI
			}
});
