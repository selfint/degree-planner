import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
	new URL('../.github/workflows/pages-staging.yml', import.meta.url),
	'utf8'
);
const job = (name) =>
	workflow.split(`\n  ${name}:\n`)[1]?.split(/\n {2}[\w-]+:\n/)[0] ?? '';

describe('verified immutable Pages publication', () => {
	it('never executes repository or candidate code with deployment credentials', () => {
		const deploy = job('deploy');
		expect(deploy).not.toMatch(
			/checkout|setup-node|npm |node |download-artifact|upload-pages-artifact/
		);
		expect(deploy).toContain('actions/deploy-pages@v4');
		expect(deploy).toContain('needs: [inspect, source, verify]');
		expect(deploy).toContain("github.ref == 'refs/heads/main'");
		expect(deploy).toContain(
			"inputs.expected_url == 'https://tom.selfin.io/degree-planner/'"
		);
		expect(deploy).toContain('pages-staging-publish');
		expect(deploy).toContain('name: github-pages');
		expect(deploy).toContain('steps.current.outputs.publish');
		expect(deploy).toContain('$main_sha');
		expect(deploy).toContain('$STAGING_SHA');
		expect(deploy).toContain("!= 'workflow'");
		expect(deploy).toContain('ACTUAL_URL');
	});
	it('pins candidate once and builds it apart from production and verification', () => {
		expect(job('source')).toContain('staging_sha');
		for (const name of ['verify', 'build-staging']) {
			expect(job(name)).toContain("base: ['', '/degree-planner']");
			expect(job(name)).toContain('persist-credentials: false');
			expect(job(name)).toContain('npm run build:pages');
			expect(job(name)).not.toMatch(/pages: write|id-token: write|secrets\./);
		}
		expect(job('build-staging')).toContain(
			'ref: ${{ needs.source.outputs.staging_sha }}'
		);
		expect(job('verify')).toContain('PUBLIC_DEPLOYMENT_ENV: production');
		expect(job('build-staging')).toContain('PUBLIC_DEPLOYMENT_ENV: staging');
		expect(job('verify')).not.toContain('PUBLIC_POSTHOG');
		expect(job('verify').match(/run: npm run build:pages/g)).toHaveLength(1);
		expect(job('verify')).not.toContain('build:pages:pair');
	});
	it('gates artifact upload on all suites for both bases with no failure bypass', () => {
		const verify = job('verify');
		expect(verify).toContain('needs: [source, build-staging]');
		expect(verify).toContain('if: always()');
		expect(verify).toContain(
			'run: test "$SOURCE_RESULT" = success && test "$STAGING_RESULT" = success'
		);
		expect(verify).toContain("base: ['', '/degree-planner']");
		for (const config of ['pages', 'analytics', 'staging'])
			expect(verify).toContain(
				`run: node scripts/runPagesBrowserTests.mjs playwright.${config}.config.ts`
			);
		expect(verify.indexOf('actions/upload-pages-artifact@v3')).toBeGreaterThan(
			verify.indexOf('playwright.staging.config.ts')
		);
		expect(verify).toContain("if: matrix.base == '/degree-planner'");
		expect(workflow).not.toMatch(
			/continue-on-error|pull_request_target|workflow_run/
		);
		expect(verify).not.toMatch(/pages: write|id-token: write|secrets\./);
	});
});

// Run the actual final guard with a fake API: a ref moving or API failure must
// never produce publish=true, even after all build/test jobs have passed.
describe('publication guard behavior', () => {
	it.each([
		['current', 'a', 'b', 0, 'true'],
		['main moved', 'c', 'b', 0, 'false'],
		['candidate moved', 'a', 'c', 0, 'false'],
		['API failed', 'a', 'b', 1, undefined]
	])('%s', async (_label, main, staging, status, publish) => {
		const { mkdtempSync, writeFileSync, rmSync, existsSync } =
			await import('node:fs');
		const { tmpdir } = await import('node:os');
		const { join } = await import('node:path');
		const { spawnSync } = await import('node:child_process');
		const dir = mkdtempSync(join(tmpdir(), 'pages-guard-'));
		try {
			writeFileSync(
				join(dir, 'gh'),
				`#!/bin/bash\nif [ "$FAKE_STATUS" != 0 ]; then exit "$FAKE_STATUS"; fi\ncase "$2" in\n */git/ref/heads/main) echo "$FAKE_MAIN";;\n *) echo "$FAKE_STAGING";;\nesac\n`,
				{ mode: 0o755 }
			);
			const script = job('deploy')
				.split('      - name: Publish only current source revisions\n')[1]
				.split('        run: |\n')[1]
				.split('\n      - uses:')[0]
				.replace(/^ {10}/gm, '');
			const result = spawnSync(
				'bash',
				['--noprofile', '--norc', '-eo', 'pipefail', '-c', script],
				{
					encoding: 'utf8',
					env: {
						...process.env,
						PATH: `${dir}:${process.env.PATH}`,
						GITHUB_REPOSITORY: 'selfint/degree-planner',
						GITHUB_SHA: 'a',
						STAGING_SHA: 'b',
						STAGING_REF: 'candidate',
						GITHUB_OUTPUT: join(dir, 'output'),
						GITHUB_STEP_SUMMARY: join(dir, 'summary'),
						FAKE_MAIN: main,
						FAKE_STAGING: staging,
						FAKE_STATUS: String(status)
					}
				}
			);
			expect(result.status).toBe(status);
			const output = existsSync(join(dir, 'output'))
				? readFileSync(join(dir, 'output'), 'utf8')
				: '';
			if (publish) expect(output).toBe(`publish=${publish}\n`);
			else expect(output).not.toContain('publish=true');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

it.each(['failure', 'cancelled', 'skipped'])(
	'fails required verify checks when a build is %s',
	async (result) => {
		const { spawnSync } = await import('node:child_process');
		const script = job('verify').match(
			/run: (test "\$SOURCE_RESULT"[^\n]+)/
		)[1];
		for (const [production, staging] of [
			[result, 'success'],
			['success', result]
		]) {
			expect(
				spawnSync('bash', ['-ec', script], {
					env: {
						...process.env,
						SOURCE_RESULT: production,
						STAGING_RESULT: staging
					}
				}).status
			).not.toBe(0);
		}
		expect(
			spawnSync('bash', ['-ec', script], {
				env: {
					...process.env,
					SOURCE_RESULT: 'success',
					STAGING_RESULT: 'success'
				}
			}).status
		).toBe(0);
	}
);
