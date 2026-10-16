/// <reference path="./types.d.ts"/>
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import * as sap from './SAPClient.mjs';
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
		const path = resolve('catalogs.json');
		const catalogs = await generateCatalogs();
		assertNotEmptyReplacement(readJsonIfPresent(path), catalogs, 'catalogs');
		writeFileSync(path, JSON.stringify(catalogs, null, '\t'));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
