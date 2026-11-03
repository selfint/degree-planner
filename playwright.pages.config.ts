import { defineConfig } from '@playwright/test';

const base = process.env.BASE_PATH ?? '/degree-planner';
export default defineConfig({
	testDir: 'pages-tests',
	timeout: 60_000,
	workers: 2,
	use: {
		baseURL: `http://127.0.0.1:4178${base}/`,
		serviceWorkers: 'block',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'desktop', use: { browserName: 'chromium' } },
		{
			name: 'mobile',
			use: {
				browserName: 'chromium',
				viewport: { width: 390, height: 844 },
				isMobile: true,
				hasTouch: true
			}
		}
	],
	webServer: {
		command: 'node scripts/servePages.mjs',
		url: `http://127.0.0.1:4178${base}/`,
		timeout: 30_000,
		reuseExistingServer: !process.env.CI
	}
});
