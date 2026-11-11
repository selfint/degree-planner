import { defineConfig } from '@playwright/test';
import preview from './playwright.preview.config';

// Reuse the real page/rail/footer checks against the local production build.
// The checked-in public datasets and all existing assertions are preserved.
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
	outputDir: 'test-results/local-rails',
	timeout: 120_000,
	use: {
		...preview.use,
		serviceWorkers: 'block'
	}
});
