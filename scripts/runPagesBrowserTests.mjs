import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Official image includes Node 24, Chromium and its OS dependencies. Keep the
// version aligned with package-lock.json; the digest makes the image immutable.
export const pagesBrowserImage =
	'mcr.microsoft.com/playwright:v1.57.0-noble@sha256:3bed4b1a12f2338642f3d8cba28e291deef3c66bd4a964bbeb3e57bbff511dbd';
const configs = [
	'playwright.pages.config.ts',
	'playwright.analytics.config.ts',
	'playwright.staging.config.ts'
];

export function pagesBrowserArgs({
	config,
	cwd = process.cwd(),
	base = process.env.BASE_PATH ?? '/degree-planner',
	uid = process.getuid(),
	gid = process.getgid(),
	version = JSON.parse(readFileSync(resolve(cwd, 'package-lock.json'), 'utf8'))
		.packages['node_modules/@playwright/test'].version
}) {
	if (!configs.includes(config)) throw new Error('Unknown Pages test config');
	if (!pagesBrowserImage.includes(`:v${version}-noble@sha256:`))
		throw new Error(
			'Update the pinned Pages browser image to match Playwright'
		);
	return [
		'run',
		'--rm',
		'--init',
		'--shm-size=1g',
		'--user',
		`${uid}:${gid}`,
		'--env',
		'CI=true',
		'--env',
		`BASE_PATH=${base}`,
		'--mount',
		`type=bind,source=${cwd},target=/work`,
		'--workdir',
		'/work',
		pagesBrowserImage,
		'node',
		'node_modules/@playwright/test/cli.js',
		'test',
		'--config',
		config
	];
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	// The built artifact, browser and static server all stay in this local
	// container. Only CI/base-path values are forwarded, not runner credentials.
	const result = spawnSync(
		'docker',
		pagesBrowserArgs({ config: process.argv[2] }),
		{ stdio: 'inherit' }
	);
	if (result.error) console.error(result.error.message);
	process.exit(result.status ?? 1);
}
