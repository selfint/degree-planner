import { defineConfig } from '@playwright/test';
import { localQaOrigin, localQaServer } from './scripts/localQa.mjs';

// Build the checked-out source and exercise its real local production server.
const baseURL = localQaOrigin(
	process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173',
	'PLAYWRIGHT_BASE_URL'
);

export default defineConfig({
	testDir: './preview-tests',
	testMatch: 'console-mobile.spec.ts',
	outputDir: 'test-results/local-preview',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	forbidOnly: Boolean(process.env.CI),
	timeout: 90_000,
	expect: { timeout: 15_000 },
	reporter: [['list']],
	webServer: localQaServer(baseURL),
	use: {
		baseURL,
		browserName: 'chromium',
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
		locale: 'en-US',
		serviceWorkers: 'allow',
		actionTimeout: 15_000,
		navigationTimeout: 45_000,
		screenshot: 'only-on-failure',
		// Artifacts deliberately omit raw HTTP headers, bodies and browser storage.
		trace: 'off',
		video: 'off'
	}
});
