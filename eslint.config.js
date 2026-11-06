import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
	{
		ignores: [
			'**/.DS_Store',
			'**/node_modules/**',
			'build/**',
			'.svelte-kit/**',
			'package/**',
			'.env',
			'.env.*',
			'!.env.example',
			'pnpm-lock.yaml',
			'package-lock.json',
			'yarn.lock',
			// Generated build, browser-test and fetched-data artifacts.
			'.vercel/**',
			'storybook-static/**',
			'test-results/**',
			'scripts/.cache/**',
			// Frozen historical implementations are independent compatibility oracles.
			'integration/fixtures/legacy-service-worker.js',
			'scripts/fixtures/legacyCatalogPipeline.mjs'
		]
	},
	js.configs.recommended,
	...ts.configs['flat/recommended'],
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node, ...globals.es2017 }
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: tsParser } },
		// The TypeScript compiler checks names, including ambient application types.
		rules: { 'no-undef': 'off' }
	},
	{
		files: ['tests/**/*.ts'],
		// Playwright requires destructuring even when only testInfo is used.
		// Empty assignment patterns remain invalid, as do empty source parameters.
		rules: {
			'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }]
		}
	},
	prettier
];
