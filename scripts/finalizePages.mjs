import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Manifest id resolves against the start URL's origin, not its directory. */
export function pagesManifest(manifest, base = '', environment = 'production') {
	return {
		...manifest,
		id: `${base}/`,
		...(environment === 'staging'
			? {
					name: 'PlanIt Staging',
					short_name: 'PlanIt Staging',
					description:
						'Analytics-free staging. Account plans are shared with production.'
				}
			: {})
	};
}

export async function finalizePages({
	env = process.env,
	root = process.cwd()
} = {}) {
	if (env.PAGES_BUILD !== 'true') return;
	const path = resolve(root, 'build/manifest.webmanifest');
	const manifest = JSON.parse(await readFile(path, 'utf8'));
	await writeFile(
		path,
		`${JSON.stringify(pagesManifest(manifest, env.BASE_PATH ?? '', env.PUBLIC_DEPLOYMENT_ENV), null, '\t')}\n`
	);
	await writeFile(resolve(root, 'build/.nojekyll'), '');
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	await finalizePages();
