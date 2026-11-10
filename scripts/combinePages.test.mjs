import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { combinePages, fallbackDispatcher } from './combinePages.mjs';
import { pagesManifest } from './finalizePages.mjs';

const roots = [];
afterEach(async () =>
	Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	)
);
async function artifacts() {
	const root = await mkdtemp(join(tmpdir(), 'pages-test-'));
	roots.push(root);
	const production = join(root, 'production');
	const staging = join(root, 'staging');
	await Promise.all([production, staging].map((path) => mkdir(path)));
	await writeFile(join(production, '404.html'), 'production fallback');
	await writeFile(
		join(staging, '404.html'),
		'<meta name="planit-deployment" content="staging">'
	);
	await writeFile(
		join(staging, 'manifest.webmanifest'),
		JSON.stringify(pagesManifest({}, '/degree-planner/staging', 'staging'))
	);
	return { production, staging, base: '/degree-planner' };
}

it('keeps both fallback apps and a separate staging manifest', async () => {
	const args = await artifacts();
	await combinePages(args);
	expect(
		await readFile(join(args.production, 'production-fallback.html'), 'utf8')
	).toBe('production fallback');
	expect(
		await readFile(join(args.production, 'staging/404.html'), 'utf8')
	).toContain('planit-deployment');
	expect(await readFile(join(args.production, '404.html'), 'utf8')).toBe(
		fallbackDispatcher(args.base)
	);
});
it('rejects a stale branch without a marked analytics-free staging build', async () => {
	const args = await artifacts();
	await writeFile(
		join(args.staging, 'manifest.webmanifest'),
		JSON.stringify({ id: '/degree-planner/staging/', name: 'PlanIt' })
	);
	await expect(combinePages(args)).rejects.toThrow('Staging artifact');
	expect(await readFile(join(args.production, '404.html'), 'utf8')).toBe(
		'production fallback'
	);
});
it('rejects an unmarked fallback even if its manifest was renamed', async () => {
	const args = await artifacts();
	await writeFile(join(args.staging, '404.html'), '<html>Old app</html>');
	await expect(combinePages(args)).rejects.toThrow('safety contract');
});
it('rejects an unsafe base before producing executable HTML', async () => {
	await expect(combinePages({ base: '/bad</script>' })).rejects.toThrow(
		'Invalid Pages'
	);
});

it('rejects a production marker even when staging text appears elsewhere', async () => {
	const args = await artifacts();
	await writeFile(
		join(args.staging, '404.html'),
		'<meta name="planit-deployment" content="production"><script>const environment = "staging";</script>'
	);
	await expect(combinePages(args)).rejects.toThrow('safety contract');
});
