import { defineConfig } from 'vitest/config';

// This Node-only suite calls the real SAP API and needs no frontend build.
export default defineConfig({
	test: {
		include: ['scripts/SAPClient.test.mjs']
	}
});
