import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	pagesBrowserArgs,
	pagesBrowserImage
} from './runPagesBrowserTests.mjs';

const read = (path) =>
	readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const options = {
	config: 'playwright.staging.config.ts',
	cwd: '/workspace/production',
	uid: 1001,
	gid: 1001,
	version: '1.57.0'
};

describe('APT-independent Pages browser tests', () => {
	it('pins the official browser image to the installed Playwright version and a digest', () => {
		const version = JSON.parse(read('package-lock.json')).packages[
			'node_modules/@playwright/test'
		].version;
		expect(pagesBrowserImage).toMatch(
			new RegExp(
				`^mcr\\.microsoft\\.com/playwright:v${version.replaceAll('.', '\\.')}-noble@sha256:[a-f0-9]{64}$`
			)
		);
		expect(() => pagesBrowserArgs({ ...options, version: '0.0.0' })).toThrow(
			'match Playwright'
		);
	});

	it.each(['', '/degree-planner'])(
		'preserves base %s and runs as the artifact owner without forwarding secrets',
		(base) => {
			expect(pagesBrowserArgs({ ...options, base })).toEqual([
				'run',
				'--rm',
				'--init',
				'--shm-size=1g',
				'--user',
				'1001:1001',
				'--env',
				'CI=true',
				'--env',
				`BASE_PATH=${base}`,
				'--mount',
				'type=bind,source=/workspace/production,target=/work',
				'--workdir',
				'/work',
				pagesBrowserImage,
				'node',
				'node_modules/@playwright/test/cli.js',
				'test',
				'--config',
				'playwright.staging.config.ts'
			]);
		}
	);

	it('rejects arbitrary configs', () => {
		expect(() => pagesBrowserArgs({ ...options, config: 'other.ts' })).toThrow(
			'Unknown Pages test config'
		);
	});

	it.each([0, 7])(
		'propagates container exit status %s instead of suppressing failures',
		(status) => {
			const directory = mkdtempSync(join(tmpdir(), 'pages-container-'));
			try {
				writeFileSync(
					join(directory, 'docker'),
					`#!/bin/sh\nexit ${status}\n`,
					{ mode: 0o755 }
				);
				const result = spawnSync(
					process.execPath,
					[
						fileURLToPath(
							new URL('./runPagesBrowserTests.mjs', import.meta.url)
						),
						options.config
					],
					{
						cwd: fileURLToPath(new URL('../', import.meta.url)),
						env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
						encoding: 'utf8'
					}
				);
				expect(result.stderr).toBe('');
				expect(result.status).toBe(status);
			} finally {
				rmSync(directory, { recursive: true, force: true });
			}
		}
	);

	it('keeps all verification suites and deployment validation without APT installs', () => {
		const workflow = read('.github/workflows/pages-staging.yml');
		expect(workflow).not.toMatch(
			/playwright install|apt-get|preferUbuntuArchive/
		);
		const [verify, deploy] = workflow.split('\n  deploy:\n');
		for (const config of ['pages', 'analytics', 'staging'])
			expect(verify).toContain(
				`run: node scripts/runPagesBrowserTests.mjs playwright.${config}.config.ts`
			);
		expect(deploy).toContain(
			'run: node scripts/runPagesBrowserTests.mjs playwright.staging.config.ts\n        working-directory: production'
		);
		expect(workflow).toContain("base: ['', '/degree-planner']");
		expect(workflow).toContain('needs: [inspect, verify]');
	});
});
