import { defineConfig } from '@playwright/test';
import preview from './playwright.preview.config';

// Reuse the real page/rail/footer checks against the exact-head public deployment.
// No local server or replacement public datasets are involved.
export default defineConfig({
	...preview,
	testDir: './tests',
	testMatch: [
		'course-catalog-rails.test.ts',
		'remaining-course-rails.test.ts',
		'search-faculty-width.test.ts',
		'search-focus.test.ts',
		'footer-controls.test.ts',
		'console-navigation-styles.test.ts',
		'search-three-columns.test.ts'
	],
	outputDir: 'test-results/deployed-rails',
	timeout: 120_000,
	use: {
		...preview.use,
		serviceWorkers: 'block'
	}
});
