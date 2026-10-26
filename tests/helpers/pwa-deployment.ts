import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Read genuine compiler output: never rewrite versions, HTML or asset URLs. */
export async function createPwaDeployment(root: string, revision: number) {
	const directory = join(root, String(revision));
	const { version } = JSON.parse(
		await readFile(join(directory, 'client/_app/version.json'), 'utf8')
	);
	if (typeof version !== 'string' || !/^[\w.-]+$/.test(version))
		throw new Error('Invalid compiled fixture version');
	const networkAssets = new Map<string, string>();
	for (const entry of await readdir(join(directory, 'client/_app/immutable'), {
		recursive: true,
		withFileTypes: true
	})) {
		if (!entry.isFile()) continue;
		const file = join(entry.parentPath, entry.name);
		const path = file.replaceAll('\\', '/').split('/client')[1];
		networkAssets.set(path, file);
	}
	const worker = await readFile(
		join(directory, 'client/service-worker.js'),
		'utf8'
	);
	if (!worker.includes(JSON.stringify(version)))
		throw new Error('Worker and version.json disagree');
	const html: Record<string, string> = JSON.parse(
		await readFile(join(directory, 'html.json'), 'utf8')
	);
	for (const [route, document] of Object.entries(html)) {
		const references = [
			...document.matchAll(/\/_app\/immutable\/[^"'\s<>]+/g)
		].map(([path]) => path);
		if (!references.some((path) => /\/entry\/start\.[^/]+\.js$/.test(path)))
			throw new Error(`Missing compiled startup entry in ${route}`);
		for (const path of references)
			if (!networkAssets.has(path))
				throw new Error(`HTML ${route} references another build: ${path}`);
	}
	return { version, networkAssets, worker, html, directory };
}
