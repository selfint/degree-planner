import { access, cp, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** GitHub Pages has one site-wide 404 document, including for nested staging. */
export function fallbackDispatcher(base = '') {
	const staging = `${base}/staging`;
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading PlanIt</title></head>
<body><p id="status" role="status">Loading PlanIt…</p><noscript>Please enable JavaScript to open this page.</noscript>
<script>
// Choose the app before running either app's code or analytics. Do not redirect:
// shared-plan queries, fragments and the original browser URL must stay intact.
const stagingBase = ${JSON.stringify(staging)};
const staging = location.pathname === stagingBase || location.pathname.startsWith(stagingBase + '/');
const fallback = staging ? stagingBase + '/404.html' : ${JSON.stringify(`${base}/production-fallback.html`)};
fetch(fallback, { credentials: 'same-origin', cache: 'no-cache' }).then(response => {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('App unavailable');
  return response.text();
}).then(html => {
  document.open();
  document.write(html);
  document.close();
}).catch(() => {
  document.getElementById('status').textContent = 'PlanIt could not load. Check your connection and reload this page.';
});
</script></body></html>\n`;
}

/** Assemble already-built artifacts; refuse an unmarked/older staging build. */
export async function combinePages({ production, staging, base = '' }) {
	if (base && (!/^\/[A-Za-z0-9/_-]+$/.test(base) || base.endsWith('/')))
		throw new Error('Invalid Pages base path.');
	const manifest = JSON.parse(
		await readFile(resolve(staging, 'manifest.webmanifest'), 'utf8')
	);
	if (manifest.id !== `${base}/staging/` || manifest.name !== 'PlanIt Staging')
		throw new Error(
			'Staging artifact must be built with its own base and PUBLIC_DEPLOYMENT_ENV=staging.'
		);
	const html = await readFile(resolve(staging, '404.html'), 'utf8');
	if (
		!/<meta\s+name=["']planit-deployment["']\s+content=["']staging["']\s*\/?\s*>/.test(
			html
		)
	)
		throw new Error(
			'Staging source does not support the deployment safety contract.'
		);
	try {
		await access(resolve(production, 'staging'));
		throw new Error(
			'Production artifact already contains a staging directory.'
		);
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
	await rename(
		resolve(production, '404.html'),
		resolve(production, 'production-fallback.html')
	);
	await cp(staging, resolve(production, 'staging'), { recursive: true });
	await writeFile(resolve(production, '404.html'), fallbackDispatcher(base));
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const [production, staging] = process.argv.slice(2);
	if (!production || !staging)
		throw new Error(
			'Usage: node scripts/combinePages.mjs <production artifact> <staging artifact>'
		);
	await combinePages({
		production,
		staging,
		base: process.env.BASE_PATH ?? ''
	});
}
