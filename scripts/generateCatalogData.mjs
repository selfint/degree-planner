import {
	readFileSync,
	writeFileSync,
	mkdirSync,
	renameSync,
	existsSync,
	rmSync
} from 'node:fs';
import { isAbsentRoot, assertRootAvailability } from './SAPClient.mjs';
import { replaceDirectory } from './dataOutput.mjs';
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
	return replaceDirectory(staticDir, (stage) =>
		writeCatalogData(rawCatalogs, stage)
	);
}

// Only call on an unpublished staging directory. The refresh includes courses
// in the same directory transaction instead of nesting a second publication.
export function writeCatalogData(rawCatalogs, staticDir) {
	// Validate the entire incoming snapshot before changing any output. The existing
	// canonical JSON remains usable when SAP fails or returns malformed data.
	const incoming = buildCatalogData(rawCatalogs);
	const previous = existsSync(join(staticDir, 'catalogs.json'))
		? readCatalogData(staticDir)
		: { catalogs: {}, requirements: new Map() };
	const baseline = new Set(
		[...previous.requirements.keys()].map((key) => {
			const [semester, , program] = key.split('/');
			return `${semester.replace('_', '/')}/${program.split('_')[0]}`;
		})
	);
	assertRootAvailability(
		rawCatalogs.map(({ track }) => track),
		rawCatalogs.map(({ tree }) => tree),
		baseline
	);
	const absentScopes = new Set(
		rawCatalogs
			.filter(({ tree }) => isAbsentRoot(tree))
			.map(
				({ track }) =>
					`${track.Peryr}_${track.Perid}/${track.OrgId}/${track.Otjid}`
			)
	);
	for (const key of previous.requirements.keys()) {
		const [year, faculty, program] = key.split('/');
		const degree = program.split('_')[0];
		if (!absentScopes.has(`${year}/${faculty}/${degree}`)) continue;
		if (
			[...incoming.requirements.keys()].some((item) =>
				item.startsWith(`${year}/${faculty}/${degree}_`)
			)
		)
			throw new Error(`Conflicting SAP availability for ${key}`);
		delete previous.catalogs[year][faculty][program];
		previous.requirements.delete(key);
		if (Object.keys(previous.catalogs[year][faculty]).length === 2)
			delete previous.catalogs[year][faculty];
		if (Object.keys(previous.catalogs[year]).length === 2)
			delete previous.catalogs[year];
		rmSync(join(staticDir, '_catalogs', key), { recursive: true, force: true });
	}
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
