import { existsSync, readFileSync } from 'node:fs';

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
