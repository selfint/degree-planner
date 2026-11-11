import { defineConfig } from '@playwright/test';
import { localQaOrigin, localQaServer } from './scripts/localQa.mjs';

const baseURL = localQaOrigin(
	process.env.STORYBOOK_TEST_BASE_URL ?? 'http://localhost:4175',
	'STORYBOOK_TEST_BASE_URL'
);
export default defineConfig({
	testDir: '.storybook/tests',
	outputDir: 'test-results/storybook',
	timeout: 45_000,
	use: {
		baseURL,
		screenshot: 'only-on-failure',
		launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
			? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
			: undefined
	},
	webServer: localQaServer(baseURL)
});
