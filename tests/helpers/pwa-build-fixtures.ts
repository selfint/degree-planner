import { execFileSync } from 'node:child_process';
import {
	cp,
	mkdtemp,
	mkdir,
	readFile,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Build real releases in isolation, once per Playwright invocation. No application
 * source or generated artifact in the developer's checkout is modified. */
export default async function setup() {
	return preparePwaFixtures();
}

export async function preparePwaFixtures({
	captureHtml = true,
	revisions = [1, 2, 3]
} = {}) {
	// Playwright CLI file filters are available before browser workers start.
	const filters = process.argv
		.slice(2)
		.filter((arg) => /\.(?:test|spec)\.[jt]s$/.test(arg));
	if (filters.length && !filters.some((arg) => arg.endsWith('pwa.test.ts')))
		return;
	const temporary = await mkdtemp(join(tmpdir(), 'planit-pwa-builds-'));
	const work = join(temporary, 'work');
	await mkdir(work);
	const root = process.cwd();
	const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
		encoding: 'utf8'
	}).trim();
	try {
		for (const path of [
			'src',
			'scripts',
			'package.json',
			'package-lock.json',
			'svelte.config.js',
			'vite.config.ts',
			'tailwind.config.js',
			'postcss.config.js',
			'tsconfig.json'
		])
			await cp(join(root, path), join(work, path), { recursive: true });
		await symlink(
			resolve(root, 'node_modules'),
			join(work, 'node_modules'),
			'dir'
		);
		await symlink(resolve(root, 'static'), join(work, 'static'), 'dir');
		const template = await readFile(join(work, 'src/app.html'), 'utf8');
		const componentPath = join(work, 'src/lib/components/CourseElement.svelte');
		const component = await readFile(componentPath, 'utf8');
		for (const revision of revisions) {
			// A genuine build input change at a fixed commit. Kit propagates the
			// canonical identity through its HTML, runtime, worker and asset graph.
			await writeFile(
				join(work, 'src/app.html'),
				template.replace('<html ', `<html data-pwa-release="${revision}" `)
			);
			await writeFile(
				componentPath,
				`${component}\n<span hidden data-pwa-release="${revision}"></span>\n`
			);
			const env = {
				...process.env,
				VERCEL_GIT_COMMIT_SHA: commit,
				NODE_ENV: 'production'
			};
			execFileSync(
				process.execPath,
				[join(root, 'node_modules/vite/bin/vite.js'), 'build'],
				{ cwd: work, env, stdio: 'inherit' }
			);
			const destination = join(temporary, String(revision));
			await mkdir(destination);
			await cp(
				join(work, '.svelte-kit/output/client'),
				join(destination, 'client'),
				{ recursive: true }
			);
			// Compilation-only validation is useful on sandbox hosts that forbid sockets.
			// The Playwright setup always captures real rendered HTML.
			if (!captureHtml) continue;
			execFileSync(
				process.execPath,
				[
					join(root, 'tests/helpers/pwa-render-fixture.mjs'),
					join(work, '.svelte-kit/output/server'),
					join(destination, 'html.json')
				],
				{ cwd: work, env, stdio: 'inherit' }
			);
		}
		process.env.PLANIT_PWA_FIXTURES = temporary;
		return () => rm(temporary, { recursive: true, force: true });
	} catch (error) {
		await rm(temporary, { recursive: true, force: true });
		throw error;
	}
}
