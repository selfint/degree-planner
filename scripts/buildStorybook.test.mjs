import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStorybook, isStorybookEnabled } from './buildStorybook.mjs';

const roots = [];
afterEach(async () =>
	Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	)
);

async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'storybook-build-'));
	roots.push(root);
	for (const path of ['.svelte-kit/output/client', '.vercel/output/static']) {
		await mkdir(join(root, path, 'storybook'), { recursive: true });
		await writeFile(join(root, path, 'storybook/stale.html'), 'old preview');
	}
	return root;
}

describe('Storybook deployment', () => {
	it.each([
		[{}, true],
		[{ VERCEL: '1', VERCEL_ENV: 'preview' }, true],
		[{ VERCEL_ENV: 'production' }, false],
		[{ VERCEL: '1' }, false],
		[{ VERCEL_ENV: 'development' }, false],
		[{ VERCEL_ENV: 'staging' }, false]
	])('gates deployment for %j', (env, enabled) =>
		expect(isStorybookEnabled(env)).toBe(enabled)
	);

	it('removes stale preview files and never starts Storybook in production', async () => {
		const root = await fixture();
		const run = vi.fn();
		expect(
			await buildStorybook({ root, env: { VERCEL_ENV: 'production' }, run })
		).toBe(false);
		expect(run).not.toHaveBeenCalled();
		for (const path of ['.svelte-kit/output/client', '.vercel/output/static']) {
			await expect(
				readFile(join(root, path, 'storybook/stale.html'))
			).rejects.toThrow();
		}
	});

	it('copies a successful build into both deployment outputs after the app build', async () => {
		const root = await fixture();
		const run = vi.fn((_node, args) => {
			const output = args[args.indexOf('--output-dir') + 1];
			mkdirSync(output, { recursive: true });
			writeFileSync(join(output, 'index.html'), 'Storybook manager');
			writeFileSync(join(output, 'iframe.html'), 'Storybook preview');
			return { status: 0 };
		});
		expect(
			await buildStorybook({ root, env: { VERCEL_ENV: 'preview' }, run })
		).toBe(true);
		for (const path of ['.svelte-kit/output/client', '.vercel/output/static']) {
			expect(
				await readFile(join(root, path, 'storybook/index.html'), 'utf8')
			).toBe('Storybook manager');
			await expect(
				readFile(join(root, path, 'storybook/stale.html'))
			).rejects.toThrow();
		}
	});

	it('fails the deployment when Storybook fails instead of publishing an empty route', async () => {
		const root = await fixture();
		await expect(
			buildStorybook({ root, env: {}, run: () => ({ status: 1 }) })
		).rejects.toThrow('Storybook build failed');
	});

	it('does not publish incomplete Storybook assets', async () => {
		const root = await fixture();
		await expect(
			buildStorybook({ root, env: {}, run: () => ({ status: 0 }) })
		).rejects.toThrow();
	});
});
