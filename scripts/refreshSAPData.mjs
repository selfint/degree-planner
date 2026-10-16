import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateCatalogs } from './generateCatalogsRaw.mjs';
import { generateCourseData } from './generateCourseData.mjs';
import { assertNotEmptyReplacement, readJsonIfPresent } from './dataOutput.mjs';

// Fail the refresh on fetch, validation, or write errors. The PR workflow gates
// publication; existing outputs are only validation baselines, never a fallback.
export async function refreshSAPData({
	root = process.cwd(),
	fetchCourses = generateCourseData,
	fetchCatalogs = generateCatalogs
} = {}) {
	const coursesPath = resolve(root, 'static/courseData.json');
	const catalogsPath = resolve(root, 'catalogs.json');
	const staticCatalogsPath = resolve(root, 'static/_catalogs');
	const previousCourses = readJsonIfPresent(coursesPath);
	const previousCatalogs =
		readJsonIfPresent(catalogsPath) ??
		(existsSync(staticCatalogsPath)
			? readdirSync(staticCatalogsPath)
			: undefined);
	const courses = await fetchCourses();
	const catalogs = await fetchCatalogs({ root });
	assertNotEmptyReplacement(previousCourses, courses, 'course data');
	assertNotEmptyReplacement(previousCatalogs, catalogs, 'catalogs');
	writeFileSync(coursesPath, JSON.stringify(courses, null, '\t'));
	writeFileSync(catalogsPath, JSON.stringify(catalogs, null, '\t'));
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
