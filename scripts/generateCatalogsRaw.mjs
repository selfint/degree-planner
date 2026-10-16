/// <reference path="./types.d.ts"/>

import { writeFileSync as _writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as sap from './SAPClient.mjs';

/**
 * @param {string} path
 * @param {string} data
 */
function writeFileSync(path, data) {
	const size = sap.formatBytes(new Blob([data]).size);
	console.error('Writing', path, `(${size})`);
	_writeFileSync(path, data, 'utf-8');
}

const cacheDir = join(process.cwd(), 'scripts', '.cache');
const rawCatalogs = join(cacheDir, 'catalogs.raw.json');

async function main() {
	const start = Date.now();
	const semesterYears = await sap.getSemesterYears();
	console.log(
		semesterYears.length,
		`Semester years: ${semesterYears.map(({ PiqSession, PiqYear }) => `${sap.getSemesterName(PiqSession).en} ${PiqYear}`).join(', ')}`
	);

	const faculties = await sap.getFaculties(semesterYears);
	console.log(
		faculties.length,
		'Faculties:',
		faculties.map((f) => f.Name.en).join(', ')
	);

	const tracks = await sap.getDegrees(faculties).then((d) => d.flat().flat());
	console.log(tracks.length, 'Tracks:', tracks.map((d) => d.Otjid).join(', '));

	const trees = await sap.getTrackTrees(tracks);

	const catalogs = [];
	const gotResults = [];
	for (let index = 0; index < tracks.length; index++) {
		const track = tracks[index];
		const tree = trees[index];

		if (tree.children !== undefined || tree.courses !== undefined) {
			gotResults.push(track.Otjid);
		}

		/** @type {Catalog} */
		const catalog = {
			track,
			tree
		};

		catalogs.push(catalog);
	}
	console.log(gotResults.length, 'Catalogs:', gotResults.join(', '));
	console.log('SAP Usage:', JSON.stringify(sap.getUsage()));
	const duration = Date.now() - start;
	const durationHour = Math.floor(duration / 3600000);
	const durationMin = Math.floor((duration % 3600000) / 60000);
	const durationSec = Math.floor((duration % 60000) / 1000);
	const durationStr = `${durationHour}:${durationMin}:${durationSec}`;
	console.log('Duration:', durationStr);

	mkdirSync(cacheDir, { recursive: true });
	writeFileSync(rawCatalogs, JSON.stringify(catalogs));
}

main();
