import { spawnSync } from 'node:child_process';
import { access, cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Preview deployments and local builds only; unknown Vercel environments fail closed. */
export function isStorybookEnabled(env = process.env) {
	return env.VERCEL_ENV === 'preview' || (!env.VERCEL_ENV && !env.VERCEL);
}

export async function buildStorybook({
	env = process.env,
	root = process.cwd(),
	run = spawnSync
} = {}) {
	const output = resolve(root, 'storybook-static');
	const destinations = [
		'.svelte-kit/output/client',
		'.vercel/output/static'
	].map((path) => resolve(root, path));
	// Clean reused workspaces too, so a production build cannot retain preview output.
	await Promise.all(
		[output, ...destinations.map((path) => resolve(path, 'storybook'))].map(
			(path) => rm(path, { recursive: true, force: true })
		)
	);
	if (!isStorybookEnabled(env)) {
		console.log('Storybook is disabled outside preview deployments.');
		return false;
	}
	const result = run(
		process.execPath,
		[
			resolve(root, 'node_modules/storybook/dist/bin/dispatcher.js'),
			'build',
			'--output-dir',
			output,
			'--disable-telemetry'
		],
		{ cwd: root, env, stdio: 'inherit' }
	);
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(
			`Storybook build failed (${result.status ?? result.signal}).`
		);
	await access(resolve(output, 'index.html'));
	await access(resolve(output, 'iframe.html'));
	let copied = 0;
	for (const destination of destinations) {
		try {
			await access(destination);
		} catch {
			continue;
		}
		await cp(output, resolve(destination, 'storybook'), { recursive: true });
		copied++;
	}
	if (!copied)
		throw new Error(
			'Build the SvelteKit application before deploying Storybook.'
		);
	return true;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	await buildStorybook();
