import { defineConfig } from '@playwright/test';

// Isolate the Firebase adapter with deterministic deferred reads. The browser
// renders the real app and layout; no production fixture hooks are introduced.
export default defineConfig({
	testDir: './account-loading-tests',
	workers: 1,
	// Two document bootstraps plus the deliberately held account reads.
	timeout: 60_000,
	use: {
		baseURL: 'http://localhost:5173',
		video: 'on',
		trace: 'retain-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				browserName: 'chromium',
				launchOptions: { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
			}
		},
		{ name: 'webkit', use: { browserName: 'webkit' } }
	],
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1',
		port: 5173,
		timeout: 60000
	}
});
