import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		timeout: 180000
	},
	testDir: 'tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [
		{
			name: 'chromium',
			use: { browserName: 'chromium', video: 'on' }
		},
		{
			name: 'webkit',
			// Keep the existing cross-browser regressions in the browser suite.
			testMatch: ['landing-parallax.test.ts', 'search-faculty-native.test.ts'],
			use: { browserName: 'webkit', video: 'on' }
		},
		{
			name: 'webkit-mobile',
			testMatch: 'search-faculty-native.test.ts',
			use: {
				browserName: 'webkit',
				viewport: { width: 390, height: 844 },
				isMobile: true,
				hasTouch: true
			}
		}
	]
});
