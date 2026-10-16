import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
	...config,
	testMatch: 'landing-parallax.test.ts',
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } },
		{ name: 'webkit', use: { browserName: 'webkit' } }
	],
	use: { trace: 'retain-on-failure', video: 'on' },
	webServer: { ...config.webServer, timeout: 180000 }
});
