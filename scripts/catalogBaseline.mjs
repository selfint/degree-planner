import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { programKeys } from './catalogData.mjs';
import { readJsonIfPresent } from './dataOutput.mjs';

// Only complete disappearance of a still-requested, previously populated scope
// is suspicious. Do not require every old ID/count to survive a legitimate update.
export function readCatalogBaseline(root) {
	const semesters = new Set();
	const faculties = new Set();
	const tracks = new Set();
	const previous =
		readJsonIfPresent(resolve(root, 'scripts/.cache/catalogs.raw.json')) ??
		readJsonIfPresent(resolve(root, 'catalogs.json'));
	if (previous) {
		for (const { track, tree } of previous) {
			const semester = `${track.Peryr}/${track.Perid}`;
			semesters.add(semester);
			faculties.add(`${semester}/${track.OrgId}`);
			if (tree?.children?.length || tree?.courses?.length)
				tracks.add(`${semester}/${track.Otjid}`);
		}
	}
	// The committed JSON is also a baseline: a stale/local raw cache must not
	// hide populated scopes from the published additive catalog snapshot.
	const manifest = readJsonIfPresent(resolve(root, 'static/catalogs.json'));
	if (manifest) {
		for (const key of programKeys(manifest)) {
			const [catalog, faculty, program] = key.split('/');
			const match = program.match(/^(SC\d+)_/);
			if (!match) continue;
			const semester = catalog.replace('_', '/');
			semesters.add(semester);
			faculties.add(`${semester}/${faculty}`);
			tracks.add(`${semester}/${match[1]}`);
		}
	} else {
		const path = resolve(root, 'static/_catalogs');
		const directories = (parent) =>
			existsSync(parent)
				? readdirSync(parent, { withFileTypes: true })
						.filter((entry) => entry.isDirectory())
						.map((entry) => entry.name)
				: [];
		for (const directory of directories(path).filter((name) =>
			/^\d{4}_20[012]$/.test(name)
		)) {
			const semester = directory.replace('_', '/');
			for (const faculty of directories(resolve(path, directory))) {
				for (const track of directories(resolve(path, directory, faculty))) {
					const match = track.match(/^(SC\d+)_/);
					if (!match) continue;
					semesters.add(semester);
					faculties.add(`${semester}/${faculty}`);
					tracks.add(`${semester}/${match[1]}`);
				}
			}
		}
	}
	return { semesters, faculties, tracks };
}
