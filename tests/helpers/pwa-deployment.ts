import { createHash } from 'node:crypto';
import { posix } from 'node:path';

/**
 * Serve one real compiled asset graph under revision-specific immutable URLs.
 * Rewriting basenames covers both relative module imports/CSS URLs and absolute
 * references in HTML, Vite's preload map, and the worker's asset manifest.
 * This is not a lifecycle mock or just a changed version.json response.
 */
export function createPwaDeployment(
	buildVersion: string,
	revision: number,
	immutablePaths: string[]
) {
	const version = `${buildVersion}-pwa-${revision}`;
	const filenames = new Map<string, string>();
	const networkAssets = new Map<string, string>();
	for (const path of immutablePaths) {
		const original = posix.basename(path);
		const extension = posix.extname(original);
		const stem = original.slice(0, -extension.length);
		const hash = createHash('sha256')
			.update(`${version}:${original}`)
			.digest('hex')
			.slice(0, 16);
		// Keep logical names such as app.*, start.*, and plan-pic.* intact:
		// the production worker uses those names when validating its own shell.
		const logicalName = stem.includes('.')
			? stem.slice(0, stem.lastIndexOf('.') + 1)
			: '';
		const renamed = `${logicalName}${hash}${extension}`;
		filenames.set(original, renamed);
		const deployed = posix.join(posix.dirname(path), renamed);
		if (networkAssets.has(deployed))
			throw new Error(`Duplicate fixture asset: ${deployed}`);
		networkAssets.set(deployed, path);
	}
	if (!networkAssets.size)
		throw new Error('Production build has no immutable assets');
	const names = [...filenames.keys()]
		.sort((a, b) => b.length - a.length)
		.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const references = new RegExp(
		`(?<![\\w.-])(?:${names.join('|')})(?![\\w.-])`,
		'g'
	);
	return {
		version,
		networkAssets,
		rewrite(source: string) {
			return source
				.replace(references, (name) => filenames.get(name)!)
				.replaceAll(JSON.stringify(buildVersion), JSON.stringify(version));
		}
	};
}
