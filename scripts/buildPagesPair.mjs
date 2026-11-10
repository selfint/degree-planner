import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { combinePages } from './combinePages.mjs';

// One Pages publication always contains both apps. A staging-only artifact must
// never replace production, and a production release must never erase staging.
const root = process.cwd();
const stagingRoot = resolve(process.env.STAGING_SOURCE_DIR ?? root);
const base = process.env.BASE_PATH ?? '/degree-planner';
const temporary = await mkdtemp(join(tmpdir(), 'planit-pages-'));
const production = join(temporary, 'production');
try {
	for (const [directory, environment, basePath] of [
		[root, 'production', base],
		[stagingRoot, 'staging', `${base}/staging`]
	]) {
		const result = spawnSync('npm', ['run', 'build:pages'], {
			cwd: directory,
			stdio: 'inherit',
			env: {
				...process.env,
				PUBLIC_DEPLOYMENT_ENV: environment,
				BASE_PATH: basePath
			}
		});
		if (result.error) throw result.error;
		if (result.status !== 0) throw new Error(`${environment} build failed.`);
		if (environment === 'production')
			await cp(resolve(root, 'build'), production, { recursive: true });
	}
	await combinePages({
		production,
		staging: resolve(stagingRoot, 'build'),
		base
	});
	await rm(resolve(root, 'build'), { recursive: true, force: true });
	await cp(production, resolve(root, 'build'), { recursive: true });
} finally {
	await rm(temporary, { recursive: true, force: true });
}
