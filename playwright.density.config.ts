import { defineConfig } from '@playwright/test';

// Run via scripts/checkMobileDensity.mjs to capture both pinned baseline and head.
export default defineConfig({
	testDir: './density-tests',
	testMatch: 'console-density.spec.ts',
	outputDir:
		process.env.DENSITY_OUTPUT_DIR ?? 'test-results/mobile-density/current',
	workers: 1,
	fullyParallel: false,
	retries: 0,
	forbidOnly: Boolean(process.env.CI),
	timeout: 120_000,
	expect: { timeout: 20_000 },
	reporter: [['list']],
	webServer: {
		command: 'npm run preview -- --host 127.0.0.1 --port 4183',
		url: 'http://127.0.0.1:4183',
		reuseExistingServer: false,
		timeout: 30_000
	},
	use: {
		browserName: 'chromium',
		isMobile: true,
		hasTouch: true,
		locale: 'en-US',
		serviceWorkers: 'allow',
		actionTimeout: 15_000,
		navigationTimeout: 45_000,
		screenshot: 'only-on-failure',
		// Synthetic guest only. Do not export browser storage, headers or HTTP bodies.
		trace: 'off',
		video: 'off'
	}
});
