import * as fs from 'node:fs';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function readJsonIfPresent(path) {
	return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}

// A shrink is not evidence of corruption: courses/degrees may be removed legitimately.
// A complete wipe of an established dataset needs a human check before publication.
export function assertNotEmptyReplacement(previous, next, label) {
	if (
		previous &&
		Object.keys(previous).length > 0 &&
		Object.keys(next).length === 0
	) {
		throw new Error(
			`Refusing to replace existing ${label} with an empty dataset; verify the upstream removal before refreshing`
		);
	}
}

// Linux renameat2 exchanges complete directory entries atomically. Unlike a
// backup/rename/rollback sequence, even a failed rollback cannot expose a mix.
export function exchangeDirectories(left, right) {
	const result = spawnSync(
		'python3',
		[
			fileURLToPath(new URL('./exchangeDirectories.py', import.meta.url)),
			left,
			right
		],
		{ encoding: 'utf8' }
	);
	if (result.error || result.status !== 0)
		throw new Error(
			`Atomic directory publication failed: ${result.error?.message ?? result.stderr}`
		);
}

export function replaceDirectory(
	directory,
	generate,
	{ operations = fs, promote = exchangeDirectories } = {}
) {
	const target = resolve(directory);
	const parent = dirname(target);
	operations.mkdirSync(parent, { recursive: true });
	const lock = join(parent, `.${basename(target)}-refresh-lock`);
	// An existing lock (including one left by a killed process) fails closed.
	operations.mkdirSync(lock);
	let stage;
	try {
		stage = operations.mkdtempSync(
			join(parent, `.${basename(target)}-refresh-`)
		);
		if (operations.existsSync(target))
			operations.cpSync(target, stage, { recursive: true });
		const result = generate(stage);
		if (operations.existsSync(target)) promote(stage, target);
		else operations.renameSync(stage, target);
		return result;
	} finally {
		// After exchange, stage is the OLD snapshot. Cleanup never rolls publication
		// back or marks an already committed snapshot as a failed refresh.
		for (const path of [stage, lock].filter(Boolean)) {
			try {
				operations.rmSync(path, { recursive: true, force: true });
			} catch (error) {
				console.error(`Refresh cleanup needed at ${path}: ${error.message}`);
			}
		}
	}
}
