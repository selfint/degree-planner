import { defineConfig } from '@playwright/test';
import tutorials from './playwright.tutorials.config';

// Focused playback/layout checks for the published Search feature slot.
export default defineConfig({
	...tutorials,
	testMatch: ['tutorials/search-feature.test.ts'],
	outputDir: 'test-results/search-feature'
});
