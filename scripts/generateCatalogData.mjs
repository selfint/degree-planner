import {
	readFileSync,
	writeFileSync,
	mkdirSync,
	renameSync,
	existsSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	buildCatalogData,
	mergeCatalogs,
	mergeRequirement,
	programKeys,
	validateRequirement
} from './catalogData.mjs';

export function readCatalogData(staticDir) {
	const catalogs = JSON.parse(
		readFileSync(join(staticDir, 'catalogs.json'), 'utf8')
	);
	const requirements = new Map(
		programKeys(catalogs).map((key) => {
			const requirement = JSON.parse(
				readFileSync(
					join(staticDir, '_catalogs', key, 'requirementsData.json'),
					'utf8'
				)
			);
			validateRequirement(requirement, key);
			return [key, requirement];
		})
	);
	return { catalogs, requirements };
}

export function generateCatalogData(rawCatalogs, staticDir) {
	// Validate the entire incoming snapshot before changing any output. The existing
	// canonical JSON remains usable when SAP fails or returns malformed data.
	const incoming = buildCatalogData(rawCatalogs);
	const previous = existsSync(join(staticDir, 'catalogs.json'))
		? readCatalogData(staticDir)
		: { catalogs: {}, requirements: new Map() };
	const catalogs = mergeCatalogs(previous.catalogs, incoming.catalogs);
	const requirements = new Map(previous.requirements);
	for (const [key, requirement] of incoming.requirements) {
		requirements.set(key, mergeRequirement(requirements.get(key), requirement));
	}
	for (const [key, requirement] of requirements)
		validateRequirement(requirement, key);
	function writeJson(path, value) {
		mkdirSync(dirname(path), { recursive: true });
		const temporaryPath = `${path}.tmp`;
		writeFileSync(temporaryPath, JSON.stringify(value));
		renameSync(temporaryPath, path);
	}
	for (const [key, requirement] of requirements) {
		writeJson(
			join(staticDir, '_catalogs', key, 'requirementsData.json'),
			requirement
		);
	}
	// Publish the index only after all referenced program files have been written.
	writeJson(join(staticDir, 'catalogs.json'), catalogs);
	return requirements.size;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	const rawPath = process.argv[2] ?? 'scripts/.cache/catalogs.raw.json';
	const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
	const count = generateCatalogData(raw, resolve('static'));
	console.log(
		`Generated ${count} program JSON files and a bilingual catalog manifest`
	);
}
