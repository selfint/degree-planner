/**
 * npm run generate-catalogs
 * node scripts/measureStartup.mjs --build --out /tmp/startup.json
 * node scripts/measureStartup.mjs --root /path/to/baseline --build --out /tmp/baseline.json
 *
 * A --build uses the target checkout's Vite config, including an ephemeral
 * instrumentation wrapper to collect Rollup source attribution. Otherwise this
 * measures existing build output without attribution. It never visits providers.
 */
import { execFileSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export function staticClosure(manifest, roots) {
	const seen = new Set();
	function visit(key) {
		if (seen.has(key)) return;
		if (!manifest[key]) throw new Error(`Missing manifest dependency: ${key}`);
		seen.add(key);
		for (const dependency of manifest[key].imports ?? []) visit(dependency);
	}
	for (const root of roots) visit(root);
	return [...seen];
}

export function readRoutes(generated) {
	const dictionary = generated.match(
		/export const dictionary = \{([\s\S]*?)\n\s*\};/
	);
	if (!dictionary) throw new Error('SvelteKit route dictionary was not found');
	const routes = [];
	const pattern = /^\s*("(?:\\.|[^"\\])*"):\s*\[(-?\d+)(?:,\[([^\]]*)\])?/gm;
	for (const match of dictionary[1].matchAll(pattern)) {
		const id = JSON.parse(match[1]);
		const leaf = Number(match[2]);
		const layouts = (match[3] ?? '')
			.split(',')
			.filter((value) => value.trim() !== '')
			.map(Number);
		if (layouts.some((node) => !Number.isInteger(node))) {
			throw new Error(`Unexpected SvelteKit layout nodes for ${id}`);
		}
		routes.push({
			id,
			path: id.replace(/\/\([^/]+\)/g, '') || '/',
			nodes: [...new Set([0, ...layouts, leaf < 0 ? ~leaf : leaf])]
		});
	}
	if (!routes.length) throw new Error('No SvelteKit routes were found');
	return routes;
}

export function moduleCategory(id) {
	const normalized = id.replaceAll('\\', '/');
	const firebase = normalized.match(/\/node_modules\/@firebase\/([^/]+)\//);
	if (firebase) {
		if (['auth', 'firestore', 'analytics'].includes(firebase[1]))
			return `firebase/${firebase[1]}`;
		return 'firebase/shared-and-other';
	}
	if (/\/node_modules\/@vercel\/analytics\//.test(normalized))
		return 'vercel/analytics';
	if (/\/node_modules\/@vercel\/speed-insights\//.test(normalized))
		return 'vercel/speed-insights';
	if (/\/node_modules\//.test(normalized)) return 'other-dependencies';
	return 'application-and-generated';
}

function moduleTotals(modules) {
	const totals = {};
	for (const [id, count] of Object.entries(modules)) {
		const category = moduleCategory(id);
		totals[category] = (totals[category] ?? 0) + count;
	}
	return totals;
}

function sumChunks(chunks) {
	return {
		files: chunks.length,
		rawBytes: chunks.reduce((total, chunk) => total + chunk.rawBytes, 0),
		gzipBytes: chunks.reduce((total, chunk) => total + chunk.gzipBytes, 0)
	};
}

function git(root, args) {
	try {
		return execFileSync('git', ['-C', root, ...args], {
			encoding: 'utf8'
		}).trim();
	} catch {
		return null;
	}
}

async function instrumentedBuild(root) {
	const require = createRequire(resolve(root, 'package.json'));
	const { build } = await import(pathToFileURL(require.resolve('vite')).href);
	const originalDirectory = process.cwd();
	const temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'degree-startup-'));
	const attributionFile = resolve(temporaryDirectory, 'modules.json');
	const temporaryConfig = resolve(temporaryDirectory, 'vite.config.mjs');
	try {
		const configFile = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']
			.map((filename) => resolve(root, filename))
			.find(existsSync);
		if (!configFile) throw new Error('Repository Vite config was not found');
		// Kit reloads the config for its nested client build. The wrapper keeps
		// this read-only instrumentation in both builds without editing config.
		writeFileSync(
			temporaryConfig,
			`
import base from ${JSON.stringify(configFile)};
import { writeFileSync } from 'node:fs';
export default async (environment) => {
  const config = await (typeof base === 'function' ? base(environment) : base);
  return { ...config, plugins: [...(config.plugins ?? []), {
    name: 'startup-measurement',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (chunk) => chunk.type === 'chunk' && chunk.fileName.startsWith('_app/immutable/')
      );
      if (!chunks.length) return;
      writeFileSync(${JSON.stringify(attributionFile)}, JSON.stringify(Object.fromEntries(
        chunks.map((chunk) => [chunk.fileName, Object.fromEntries(
          Object.entries(chunk.modules).map(([id, module]) => [id, module.renderedLength])
        )])
      )));
    }
  }] };
};
`
		);
		process.chdir(root);
		await build({ root, configFile: temporaryConfig });
		return JSON.parse(readFileSync(attributionFile, 'utf8'));
	} finally {
		process.chdir(originalDirectory);
		rmSync(temporaryDirectory, { recursive: true, force: true });
	}
}

export async function measureStartup({ root, rebuild = false }) {
	root = resolve(root);
	const clientRoot = resolve(root, '.svelte-kit/output/client');
	const moduleMap = rebuild ? await instrumentedBuild(root) : undefined;
	const manifest = JSON.parse(
		readFileSync(resolve(clientRoot, '.vite/manifest.json'), 'utf8')
	);
	const generatedPath = ['client-optimized', 'client']
		.map((directory) =>
			resolve(root, `.svelte-kit/generated/${directory}/app.js`)
		)
		.find(existsSync);
	if (!generatedPath)
		throw new Error(
			'Build first: generated SvelteKit client app was not found'
		);
	const routes = readRoutes(readFileSync(generatedPath, 'utf8'));
	const bootstrap = Object.keys(manifest).filter((key) =>
		['entry/start', 'entry/app'].includes(manifest[key].name)
	);
	if (bootstrap.length !== 2)
		throw new Error('Expected SvelteKit start and app entry chunks');
	const chunks = Object.fromEntries(
		Object.entries(manifest)
			.filter(([, chunk]) => chunk.file.endsWith('.js'))
			.map(([key, chunk]) => {
				const source = readFileSync(resolve(clientRoot, chunk.file));
				return [
					key,
					{
						file: chunk.file,
						rawBytes: source.length,
						gzipBytes: gzipSync(source).length,
						...(moduleMap?.[chunk.file]
							? {
									renderedModuleCharacters: moduleTotals(moduleMap[chunk.file])
								}
							: {})
					}
				];
			})
	);
	const measuredRoutes = routes.map((route) => {
		const prerenderedRoot = resolve(
			root,
			'.svelte-kit/output/prerendered/pages'
		);
		const htmlPath = resolve(
			prerenderedRoot,
			route.path === '/' ? 'index.html' : `${route.path.slice(1)}.html`
		);
		const trailingSlashPath = resolve(
			prerenderedRoot,
			route.path.slice(1),
			'index.html'
		);
		const prerenderedPath = [htmlPath, trailingSlashPath].find(existsSync);
		const html = prerenderedPath
			? readFileSync(prerenderedPath, 'utf8')
			: undefined;
		const staticHtmlOnly = html !== undefined && !html.includes('__sveltekit_');
		const nodeKeys = staticHtmlOnly
			? []
			: route.nodes.map((node) => {
					const key = Object.keys(manifest).find(
						(key) => manifest[key].name === `nodes/${node}`
					);
					if (!key)
						throw new Error(`Missing route node ${node} for ${route.id}`);
					return key;
				});
		const keys = staticHtmlOnly
			? []
			: staticClosure(manifest, [...bootstrap, ...nodeKeys]);
		const selected = keys.map((key) => chunks[key]).filter(Boolean);
		const dynamicRoots = [
			...new Set(keys.flatMap((key) => manifest[key].dynamicImports ?? []))
		].filter((key) => !/\/nodes\/\d+\.js$/.test(key) && !keys.includes(key));
		const dynamicKeys = staticClosure(manifest, dynamicRoots).filter(
			(key) => !keys.includes(key)
		);
		return {
			...route,
			mode: staticHtmlOnly
				? 'prerendered-without-kit-bootstrap'
				: 'kit-route-static-import-graph',
			...(prerenderedPath
				? { prerenderedHtml: relative(root, prerenderedPath) }
				: {}),
			initial: sumChunks(selected),
			initialChunks: selected.sort((a, b) => b.rawBytes - a.rawBytes),
			// Reachable imports are not proof they execute during startup.
			reachableNonRouteDynamic: sumChunks(
				dynamicKeys.map((key) => chunks[key]).filter(Boolean)
			),
			reachableNonRouteDynamicChunks: dynamicKeys
				.map((key) => chunks[key])
				.filter(Boolean)
		};
	});
	return {
		schemaVersion: 1,
		measuredAt: new Date().toISOString(),
		revision: git(root, ['rev-parse', 'HEAD']),
		trackedWorkingTreeDirty: Boolean(
			git(root, ['status', '--porcelain', '--untracked-files=no'])
		),
		nodeVersion: process.version,
		packageLockRevision: git(root, ['hash-object', 'package-lock.json']),
		moduleAttributionAvailable: Boolean(moduleMap),
		method: {
			initial:
				'Unique static imports of SvelteKit entry/start + entry/app and selected root/layout/page nodes. No Kit bootstrap in prerendered HTML means zero emitted route JS.',
			gzip: 'Sum of per-file Node gzipSync default compression, including each gzip header; not measured transfer bytes.',
			attribution:
				'Rollup renderedLength before final chunk minification, in characters. Category sizes are not minified bytes or independently compressed sizes.',
			exclusions:
				'CSS, images, inline scripts, public catalog JSON, external provider scripts, service-worker prefetch, and imports invoked at runtime are excluded from initial static-import totals.',
			limitations:
				'No browser startup timing or observed request count. A runtime import can execute immediately despite being excluded; use browser network tests for ordering.'
		},
		routes: measuredRoutes,
		largestEmittedChunks: Object.values(chunks)
			.sort((a, b) => b.rawBytes - a.rawBytes)
			.slice(0, 12)
	};
}

async function main() {
	const args = process.argv.slice(2);
	let root = process.cwd();
	let output;
	let rebuild = false;
	for (let index = 0; index < args.length; index++) {
		if (args[index] === '--build') rebuild = true;
		else if (args[index] === '--root' && args[index + 1]) root = args[++index];
		else if (args[index] === '--out' && args[index + 1])
			output = resolve(args[++index]);
		else throw new Error(`Unknown or incomplete argument: ${args[index]}`);
	}
	const result = await measureStartup({ root, rebuild });
	const json = `${JSON.stringify(result, null, 2)}\n`;
	if (output) {
		mkdirSync(dirname(output), { recursive: true });
		writeFileSync(output, json);
		console.log(`Startup measurement saved to ${output}`);
	} else console.log(json);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
