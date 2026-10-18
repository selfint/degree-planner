import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
	testDir: '.',
	testMatch: ['tutorials/recordings.spec.ts', 'tutorials/landing.test.ts'],
	outputDir: 'test-results/tutorials-checks',
	workers: 1,
	timeout: 120_000,
	retries: 0,
	use: {
		baseURL,
		browserName: 'chromium',
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
