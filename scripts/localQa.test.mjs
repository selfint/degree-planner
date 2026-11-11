import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	assertLocalQaTargets,
	localQaOrigin,
	localQaServer
} from './localQa.mjs';

const read = (path) =>
	readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('local-only browser QA', () => {
	it.each([
		'http://localhost:4173',
		'http://127.0.0.1:4175/',
		'http://[::1]:4173'
	])('accepts loopback origin %s', (value) => {
		expect(localQaOrigin(value)).toBe(new URL(value).origin);
	});

	it.each([
		'https://degree-planner.vercel.app',
		'http://degree-planner.vercel.app',
		'https://tom.selfin.io',
		'http://localhost.example.com:4173',
		'http://192.168.1.2:4173',
		'https://localhost:4173',
		'http://user:password@localhost:4173',
		'http://localhost:4173/app/',
		'http://localhost:4173?target=preview',
		'http://localhost:4173#preview'
	])('rejects nonlocal or ambiguous target %s', (value) => {
		expect(() => localQaOrigin(value)).toThrow(/loopback origin/);
	});

	it.each(['PLAYWRIGHT_BASE_URL', 'STORYBOOK_TEST_BASE_URL', 'PREVIEW_URL'])(
		'guards inherited %s before tests start',
		(name) => {
			expect(() =>
				assertLocalQaTargets({ [name]: 'https://preview.vercel.app' })
			).toThrow(name);
			expect(() =>
				assertLocalQaTargets({ [name]: 'http://127.0.0.1:4173' })
			).not.toThrow();
		}
	);

	it('starts a fresh local build by default and never reuses a CI server', () => {
		expect(localQaServer('http://localhost:4173', { CI: 'true' })).toEqual({
			command:
				'npm run build && npm run preview -- --host localhost --port 4173 --strictPort',
			url: 'http://localhost:4173',
			timeout: 180_000,
			reuseExistingServer: false
		});
		expect(
			localQaServer('http://127.0.0.1:4175', {
				CI: 'true',
				PLANIT_QA_PREBUILT: '1'
			}).command
		).toBe('npm run preview -- --host 127.0.0.1 --port 4175 --strictPort');
		expect(() => localQaServer('https://preview.vercel.app')).toThrow();
	});

	it('keeps mobile, rail and the complete Storybook suite in local CI', () => {
		const workflow = read('.github/workflows/test.yml');
		expect(workflow).toContain('local-console-mobile:');
		expect(workflow).toContain('playwright.preview.config.ts');
		expect(workflow).toContain('playwright.rails-preview.config.ts');
		expect(workflow).toContain('run: npm run test:storybook');
		expect(workflow).toContain('run: npm run build');
		expect(read('playwright.preview.config.ts')).toContain(
			'webServer: localQaServer(baseURL)'
		);
		expect(read('playwright.storybook.config.ts')).toContain(
			"testDir: '.storybook/tests'"
		);
		expect(read('playwright.storybook.config.ts')).toContain(
			'webServer: localQaServer(baseURL)'
		);
	});

	it('does not wait for or navigate to hosted deployments in any workflow', () => {
		for (const file of readdirSync(
			new URL('../.github/workflows/', import.meta.url)
		)) {
			if (!/\.ya?ml$/.test(file)) continue;
			expect(read(`.github/workflows/${file}`)).not.toMatch(
				/vercel\.app|waitForPreview|PREVIEW_URL|STORYBOOK_TEST_BASE_URL:\s*https:/i
			);
		}
	});

	it('guards configs whose test helpers accept URL overrides', () => {
		for (const file of [
			'playwright.config.ts',
			'playwright.tutorials.config.ts',
			'playwright.journeys.config.ts',
			'playwright.preview.config.ts',
			'playwright.storybook.config.ts'
		])
			expect(read(file)).toContain('./scripts/localQa.mjs');
	});
});

describe('opt-in Vercel Git previews', () => {
	it('disables all branch patterns while keeping main explicitly enabled', () => {
		expect(JSON.parse(read('vercel.json')).git.deploymentEnabled).toEqual({
			'**': false,
			main: true
		});
	});
});
