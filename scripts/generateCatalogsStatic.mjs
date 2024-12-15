/// <reference path="./types.d.ts"/>

import { writeFileSync as _writeFileSync, readFileSync, mkdirSync } from 'fs';
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
const dbPath = join(process.cwd(), 'static', '_catalogs');
const manifestPath = join(
	process.cwd(),
	'src',
	'lib',
	'assets',
	'catalogs.json'
);

const AllTechnionElectivesCgId = 'CG00000170';
const FreeElectives = 'CG00000175';

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
	const catalogs = JSON.parse(readFileSync(rawCatalogs, 'utf-8'));

	for (const catalog of catalogs) {
		console.log('Writing catalog:', catalog.track.Name.en);
		writeCatalog(dbPath, catalog);
	}
}

main();
