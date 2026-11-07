import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { programKeys } from './catalogData.mjs';
import { writeCatalogData, readCatalogData } from './generateCatalogData.mjs';
import { assertRootAvailability } from './SAPClient.mjs';
import { readCatalogBaseline } from './catalogBaseline.mjs';
import { generateCatalogs } from './generateCatalogsRaw.mjs';
import { generateCourseData } from './generateCourseData.mjs';
import {
	assertNotEmptyReplacement,
	readJsonIfPresent,
	replaceDirectory
} from './dataOutput.mjs';

// Fetch everything first, then generate and validate a private replacement.
// One atomic directory exchange publishes courses and all derived catalog files.
export async function refreshSAPData({
	root = process.cwd(),
	fetchCourses = generateCourseData,
	fetchCatalogs = generateCatalogs,
	generate = writeCatalogData,
	publication = {}
} = {}) {
	const coursesPath = resolve(root, 'static/courseData.json');
	const catalogsPath = resolve(root, 'scripts/.cache/catalogs.raw.json');
	const staticCatalogsPath = resolve(root, 'static/_catalogs');
	const previousCourses = readJsonIfPresent(coursesPath);
	const previousCatalogs =
		readJsonIfPresent(catalogsPath) ??
		readJsonIfPresent(resolve(root, 'catalogs.json')) ??
		readJsonIfPresent(resolve(root, 'static/catalogs.json')) ??
		(existsSync(staticCatalogsPath)
			? readdirSync(staticCatalogsPath)
			: undefined);
	const courses = await fetchCourses();
	const catalogs = await fetchCatalogs({ root });
	assertNotEmptyReplacement(previousCourses, courses, 'course data');
	assertNotEmptyReplacement(previousCatalogs, catalogs, 'catalogs');
	assertRootAvailability(
		catalogs.map(({ track }) => track),
		catalogs.map(({ tree }) => tree),
		readCatalogBaseline(root).tracks
	);
	return replaceDirectory(
		resolve(root, 'static'),
		(stage) => {
			generate(catalogs, stage);
			const replacement = readCatalogData(stage);
			assertNotEmptyReplacement(
				previousCatalogs,
				programKeys(replacement.catalogs),
				'usable catalogs'
			);
			writeFileSync(
				resolve(stage, 'courseData.json'),
				JSON.stringify(courses, null, '\t')
			);
		},
		publication
	);
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	try {
		await refreshSAPData();
	} catch (error) {
		console.error(
			`SAP refresh stopped; fetch/validation must succeed before publication: ${error.message}`
		);
		process.exitCode = 1;
	}
}
