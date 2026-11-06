import { defineConfig } from '@playwright/test';

const external = process.env.STORYBOOK_TEST_BASE_URL;
export default defineConfig({
	testDir: '.storybook/tests',
	outputDir: 'test-results/storybook',
	timeout: 45_000,
	use: {
		baseURL: external ?? 'http://localhost:4175',
		screenshot: 'only-on-failure',
		launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
			? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
			: undefined
	},
	webServer: external
		? undefined
		: {
				command:
					'npm run build && npm run preview -- --port 4175 --host 127.0.0.1',
				url: 'http://localhost:4175',
				timeout: 180_000,
				reuseExistingServer: !process.env.CI
			}
});
