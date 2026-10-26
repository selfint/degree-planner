import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const BUILD_CONFIG_FILES = [
	'package.json',
	'package-lock.json',
	'svelte.config.js',
	'vite.config.ts',
	'tailwind.config.js',
	'postcss.config.js',
	'tsconfig.json',
	'scripts/buildIdentity.mjs'
];
const SHELL_STATIC_FILES = [
	'manifest.webmanifest',
	'favicon.webp',
	'brand/planit-logo.webp',
	'brand/planit-wordmark.svg'
];

// Shared with Kit's SW manifest: datasets and tutorial media are independent
// network resources, not part of the installed app's immutable artifact graph.
/** @param {string} file */
export function isOfflineShellStaticFile(file) {
	return SHELL_STATIC_FILES.includes(file) || file.startsWith('icons/');
}

/** @param {string} path */
export function isBuildInputPath(path) {
	return (
		BUILD_CONFIG_FILES.includes(path) ||
		(path.startsWith('src/') &&
			!path.startsWith('src/stories/') &&
			!/\.(?:test|spec|stories)\.[^/]+$/.test(path)) ||
		(path.startsWith('static/') && isOfflineShellStaticFile(path.slice(7)))
	);
}

/** The version describes reproducible build inputs, never build time or a
 * deployment ID. A commit is provenance, not sufficient cache identity.
 * @param {{ files: Iterable<[string, string | Uint8Array]>, commit?: string | null,
 * mode?: string, nodeVersion?: string, platform?: string, arch?: string }} options
 */
export function computeBuildIdentity({
	files,
	commit = null,
	mode = 'production',
	nodeVersion = process.version,
	platform = process.platform,
	arch = process.arch
}) {
	if (commit !== null && !/^[a-f0-9]{40,64}$/i.test(commit))
		throw new Error('The build commit must be a complete Git object ID.');
	const hash = createHash('sha256');
	/** @param {string} name @param {string | Uint8Array} bytes */
	const add = (name, bytes) => {
		const body = Buffer.from(bytes);
		hash.update(JSON.stringify([name, body.length]));
		hash.update(body);
	};
	// No runtime secrets or unused PUBLIC_/VITE_ environment variables are read.
	// The only current environment-dependent app branch is import.meta.env.PROD.
	add('toolchain', JSON.stringify({ mode, nodeVersion, platform, arch }));
	for (const [path, bytes] of [...files]
		.filter(([path]) => isBuildInputPath(path))
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
		add(path, bytes);
	}
	return `${commit?.toLowerCase() ?? 'local'}-${hash.digest('hex').slice(0, 16)}`;
}

export function readBuildCommit(env = process.env, directory = root) {
	if (env.VERCEL_GIT_COMMIT_SHA) return env.VERCEL_GIT_COMMIT_SHA;
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: directory,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim();
	} catch {
		return null;
	}
}

export function readBuildIdentity(directory = root, env = process.env) {
	/** @type {Array<[string, string | Uint8Array]>} */
	const files = [];
	/** @param {string} path */
	function add(path) {
		files.push([path, readFileSync(join(directory, path))]);
	}
	/** @param {string} path */
	function visit(path) {
		for (const entry of readdirSync(join(directory, path), {
			withFileTypes: true
		})) {
			const child = `${path}/${entry.name}`;
			if (entry.isDirectory()) {
				if (child !== 'src/stories') visit(child);
			} else if (entry.isFile() && isBuildInputPath(child)) add(child);
		}
	}
	visit('src');
	visit('static/icons');
	for (const path of BUILD_CONFIG_FILES) add(path);
	for (const path of SHELL_STATIC_FILES) add(`static/${path}`);
	return computeBuildIdentity({
		files,
		commit: readBuildCommit(env, directory),
		mode: env.NODE_ENV ?? 'production'
	});
}
