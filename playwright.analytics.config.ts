import { defineConfig } from '@playwright/test';

const base = process.env.BASE_PATH ?? '/degree-planner';
export default defineConfig({
	testDir: 'analytics-tests',
	timeout: 60_000,
	workers: 1,
	use: {
		baseURL: `http://127.0.0.1:4178${base}/`,
		serviceWorkers: 'block',
		// The SDK excludes HeadlessChrome; exercise explicit capture as a normal browser.
		userAgent:
			'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
			? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
			: undefined
	},
	webServer: {
		command: 'node scripts/servePages.mjs',
		url: `http://127.0.0.1:4178${base}/`,
		timeout: 30_000
	}
});
