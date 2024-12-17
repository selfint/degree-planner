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

const rawCatalogs = join(process.cwd(), 'catalogs.json');

/**
 * @param {string} path base path to write the tree
 * @param {Tree} tree to write
 */
function writeTreeSync(path, tree) {
	let treePath = join(path, tree.Otjid);

	// inline structure elements
	if (tree.Name.en.toLowerCase().startsWith('structure element')) {
		treePath = path;
	} else {
		mkdirSync(treePath, { recursive: true });

		writeFileSync(join(treePath, 'en'), tree.Name.en);
		writeFileSync(join(treePath, 'he'), tree.Name.he);
		if (tree.courses !== undefined) {
			writeFileSync(
				join(treePath, 'courses'),
				tree.courses.map((course) => course.slice(2)).join('\n')
			);
		}
	}

	const children = tree.children;
	if (children !== undefined) {
		for (const child of children) {
			writeTreeSync(treePath, child);
		}
	}
}

/**
 * @param {string} dbPath path to local database root dir
 * @param {Catalog} catalog to write to disk
 */
function writeCatalog(dbPath, catalog) {
	const track = catalog.track;
	const year = track.Peryr;
	const semester = track.Perid;

	const yearSemesterPath = join(dbPath, `${year}_${semester}`);
	const orgId = track.OrgId;
	const orgPath = join(yearSemesterPath, orgId);
	const orgTracks = catalog.tree.children?.at(0);
	if (orgTracks === undefined) {
		console.error('No tracks found for', track.Otjid);
		return;
	}
	const orgTracksPath = join(orgPath, `${track.Otjid}_${orgTracks.Otjid}`);

	mkdirSync(yearSemesterPath, { recursive: true });
	writeFileSync(
		join(yearSemesterPath, 'en'),
		`${year} ${sap.getSemesterName(semester).en}`
	);
	writeFileSync(
		join(yearSemesterPath, 'he'),
		`${year} ${sap.getSemesterName(semester).he}`
	);

	mkdirSync(orgPath, { recursive: true });
	writeFileSync(join(orgPath, 'en'), track.OrgText.en);
	writeFileSync(join(orgPath, 'he'), track.OrgText.he);

	mkdirSync(join(orgTracksPath, 'requirement'), { recursive: true });
	writeFileSync(join(orgTracksPath, 'en'), track.ZzQualifications.en);
	writeFileSync(join(orgTracksPath, 'he'), track.ZzQualifications.he);
	writeFileSync(
		join(orgTracksPath, 'requirement', 'en'),
		track.ZzQualifications.en
	);
	writeFileSync(
		join(orgTracksPath, 'requirement', 'he'),
		track.ZzQualifications.he
	);

	for (const track of orgTracks.children ?? []) {
		writeTreeSync(join(orgTracksPath, 'requirement'), track);
	}
}

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

	// serialize catalogs to ./catalogs.json
	writeFileSync(rawCatalogs, JSON.stringify(catalogs, null, '\t'));

	// deserialize catalogs from ./catalogs.json
	// const catalogs = JSON.parse(readFileSync(rawCatalogs, 'utf-8'));

	// for (const catalog of catalogs) {
	// 	console.log('Writing catalog:', catalog.track.Name.en);
	// 	writeCatalog(dbPath, catalog);
	// }
}

main();
