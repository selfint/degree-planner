import { defineConfig } from '@playwright/test';

// Intentionally independent of the localhost production-build/proxy suites.
// PREVIEW_URL=https://... npx playwright test --config=playwright.preview.config.ts
const preview = new URL(process.env.PREVIEW_URL ?? 'https://missing.invalid');
if (
	!process.env.PREVIEW_URL ||
	preview.protocol !== 'https:' ||
	preview.hostname === 'localhost' ||
	preview.username ||
	preview.password ||
	preview.pathname !== '/' ||
	preview.search ||
	preview.hash
)
	throw new Error(
		'PREVIEW_URL must be the HTTPS origin of a published preview.'
	);

export default defineConfig({
	testDir: './preview-tests',
	testMatch: 'console-mobile.spec.ts',
	outputDir: 'test-results/deployed-preview',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	forbidOnly: Boolean(process.env.CI),
	timeout: 90_000,
	expect: { timeout: 15_000 },
	reporter: [['list']],
	use: {
		baseURL: preview.origin,
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
