import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pagesBrowserImage } from './runPagesBrowserTests.mjs';

const read = (path) =>
	readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const job = (workflow, name) =>
	workflow.split(`\n  ${name}:\n`)[1]?.split(/\n {2}[\w-]+:\n/)[0];

describe('APT-independent automatic browser CI', () => {
	it.each([
		['test', 'browser'],
		['test', 'local-console-mobile'],
		['analytics', 'analytics']
	])(
		'%s/%s uses the version-pinned official image without runtime browser installs',
		(file, name) => {
			const source = job(read(`.github/workflows/${file}.yml`), name);
			expect(source).toContain(`image: ${pagesBrowserImage}`);
			expect(source).toContain('options: --shm-size=1g');
			expect(source).not.toMatch(
				/playwright install|apt-get|preferUbuntuArchive/
			);
		}
	);

	it('preserves Chromium, WebKit, focused, full, worker and density checks', () => {
		const source = job(read('.github/workflows/test.yml'), 'browser');
		for (const check of [
			'browser: chromium',
			'browser: webkit',
			'playwright.account-loading.config.ts',
			'tests/plan-board-alignment.test.ts',
			'tests/plan-mobile-drag.test.ts',
			'npm run test:integration',
			'vitest.integration.config.ts',
			'node scripts/checkMobileDensity.mjs'
		])
			expect(source).toContain(check);
	});
});
