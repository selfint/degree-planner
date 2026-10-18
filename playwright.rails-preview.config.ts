import { defineConfig } from '@playwright/test';
import preview from './playwright.preview.config';

// Reuse the real page/rail checks against the exact-head public deployment.
// No local server or replacement public datasets are involved.
export default defineConfig({
	...preview,
	testDir: './tests',
	testMatch: 'course-catalog-rails.test.ts',
	outputDir: 'test-results/deployed-rails',
	timeout: 120_000,
	use: {
		...preview.use,
		serviceWorkers: 'block'
	}
});
