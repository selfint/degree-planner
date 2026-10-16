import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
	...config,
	testMatch: 'search-faculty-native.test.ts',
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } },
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
