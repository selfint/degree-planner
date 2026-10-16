import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// This separate gate isolates durable course data and already-loaded navigation.
// CI also runs page-level cold offline shell cases with WebKit in pwa.test.ts;
// neither gate claims physical iOS installed-app or Google login coverage.
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
