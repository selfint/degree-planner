import { defineConfig } from '@playwright/test';

const mobile = {
	viewport: { width: 390, height: 844 },
	isMobile: true,
	hasTouch: true
};
const durableData =
	/downloads every canonical course|reopens an exact previously visited course|reports a failed refresh/;

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		timeout: 180000
	},
	testDir: 'tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	// Network fixtures stay deterministic. The real PWA suite explicitly opts in.
	use: {
		serviceWorkers: 'block',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium', video: 'on' } },
		{
			name: 'webkit',
			testMatch: [
				'landing-parallax.test.ts',
				'landing-install.test.ts',
				'search-faculty-native.test.ts',
				'search-faculty-width.test.ts',
				'console-startup.test.ts',
				'console-routing.test.ts'
			],
			use: { browserName: 'webkit', video: 'on' }
		},
		{
			name: 'webkit-mobile',
			testMatch: [
				'search-faculty-native.test.ts',
				'search-faculty-width.test.ts',
				'course-card-navigation.test.ts',
				'course-catalog-rails.test.ts',
				'remaining-course-rails.test.ts',
				'console-button-layout.test.ts',
				'console-navigation-styles.test.ts',
				'search-three-columns.test.ts',
				'footer-controls.test.ts',
				'plan-board-alignment.test.ts',
				'plan-dependencies.test.ts'
			],
			use: { browserName: 'webkit', ...mobile }
		},
		{
			name: 'webkit-data',
			testMatch: 'indexeddb-data.test.ts',
			grep: durableData,
			use: { browserName: 'webkit' }
		},
		{
			name: 'webkit-data-mobile',
			testMatch: 'indexeddb-data.test.ts',
			grep: durableData,
			use: { browserName: 'webkit', ...mobile }
		},
		// WebKit's offline emulator rejects service-worker responses; these cases
		// disconnect the test origin to cover cold offline routes and reloads.
		{
			name: 'webkit-shell',
			testMatch: 'pwa.test.ts',
			grep: /first opening|versioned dismissal/,
			use: { browserName: 'webkit' }
		}
	]
});
