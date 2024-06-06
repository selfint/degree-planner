import type { Writable } from 'svelte/store';
import { writable, derived } from 'svelte/store';
import manifest from '$lib/assets/manifest.json';

export const username = writable<string | undefined>(undefined);
export const degree = writable<Degree | undefined>(undefined);
export const requirements = derived<Writable<Degree | undefined>, Requirements | undefined>(
	degree,
	($degree) => {
		if ($degree === undefined) return undefined;

		// @ts-expect-error
		return manifest[$degree[0]][$degree[1]][$degree[2]].requirements;
	}
);
export const semesters = writable<string[][] | undefined>(undefined);
export const currentSemester = writable<number | undefined>(undefined);
