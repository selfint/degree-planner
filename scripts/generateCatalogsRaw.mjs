/// <reference path="./types.d.ts"/>
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as sap from './SAPClient.mjs';
import { buildCatalogData } from './catalogData.mjs';
import { readCatalogBaseline } from './catalogBaseline.mjs';
import { assertNotEmptyReplacement, readJsonIfPresent } from './dataOutput.mjs';

export async function generateCatalogs({ root = process.cwd() } = {}) {
	const baseline = readCatalogBaseline(root);
	const semesterYears = await sap.getSemesterYears();
	const faculties = await sap.getFaculties(semesterYears, baseline.semesters);
	const tracks = (await sap.getDegrees(faculties, baseline.faculties)).flat();
	const trees = await sap.getTrackTrees(tracks, baseline.tracks);
	const catalogs = tracks.map((track, index) => ({
		track,
		tree: trees[index]
	}));
	console.error(
		`Fetched ${semesterYears.length} semesters, ${faculties.length} faculties and ${catalogs.length} catalogs`
	);
	return catalogs;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	try {
		const path = resolve('scripts/.cache/catalogs.raw.json');
		const catalogs = await generateCatalogs();
		assertNotEmptyReplacement(readJsonIfPresent(path), catalogs, 'catalogs');
		buildCatalogData(catalogs);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, JSON.stringify(catalogs, null, '\t'));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
