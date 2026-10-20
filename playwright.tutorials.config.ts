import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
	testDir: '.',
	testMatch: [
		'tutorials/recordings.spec.ts',
		'tutorials/search-recordings.spec.ts',
		'tutorials/search-feature.test.ts',
		'tutorials/landing.test.ts'
	],
	outputDir: 'test-results/tutorials-checks',
	workers: 1,
	timeout: 120_000,
	retries: 0,
	use: {
		baseURL,
		browserName: 'chromium',
		launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
			? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
			: undefined,
		serviceWorkers: 'block',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	webServer: process.env.PLAYWRIGHT_BASE_URL
		? undefined
		: {
				command: 'npm run build && npm run preview',
				url: baseURL,
				timeout: 180_000,
				reuseExistingServer: !process.env.CI
			}
});
