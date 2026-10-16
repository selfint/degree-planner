import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Playwright supports service-worker automation on Chromium only. This separate
// WebKit gate checks durable course data and already-loaded route navigation,
// without claiming installed iOS PWA or offline shell lifecycle coverage.
export default defineConfig({
	...config,
	testMatch: 'indexeddb-data.test.ts',
	grep: /downloads every canonical course|reopens an exact previously visited course/,
	projects: [
		{ name: 'webkit', use: { browserName: 'webkit' } },
		{
			name: 'webkit-mobile',
			use: {
				browserName: 'webkit',
				viewport: { width: 390, height: 844 },
				isMobile: true,
				hasTouch: true
			}
		}
	],
	use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	webServer: { ...config.webServer, timeout: 180000 }
});
