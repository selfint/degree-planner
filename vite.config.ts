import { sveltekit } from '@sveltejs/kit/vite';
import { configDefaults, defineConfig } from 'vitest/config';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { isStorybookEnabled } from './scripts/buildStorybook.mjs';
import { readBuildCommit } from './scripts/buildIdentity.mjs';

export default defineConfig({
	define: {
		__PLANIT_BUILD_SHA__: JSON.stringify(readBuildCommit()),
		__PLANIT_STATIC_BUILD__: process.env.PAGES_BUILD === 'true',
		__PLANIT_STORYBOOK_ENABLED__: isStorybookEnabled()
	},
	plugins: [enhancedImages(), sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.mjs'],
		// The live SAP suite runs separately via test:sap.
		exclude: [...configDefaults.exclude, 'scripts/SAPClient.test.mjs']
	}
});
