/// <reference path="./types.d.ts"/>

import {
	readdirSync,
	statSync,
	writeFileSync as _writeFileSync,
	readFileSync,
	mkdirSync
} from 'fs';
import { join } from 'path';

/**
 * @param {number} bytes
 * @param {number} decimals
 * @returns
 */
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function writeFileSync(path, data) {
	const size = formatBytes(new Blob([data]).size);
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

function main() {
	/** @type {Catalog[]} */
	const catalogs = JSON.parse(readFileSync(rawCatalogs, 'utf-8'));

	const semesterNames = new Map([
		['200', { en: 'Winter', he: 'חורף' }],
		['201', { en: 'Spring', he: 'אביב' }],
		['202', { en: 'Summer', he: 'קיץ' }]
	]);

	for (const catalog of catalogs) {
		const year = catalog.Peryr;
		const semester = catalog.Perid;

		const yearSemesterPath = join(dbPath, `${year}_${semester}`);
		mkdirSync(yearSemesterPath, { recursive: true });

		writeFileSync(
			join(yearSemesterPath, 'en'),
			year + ' ' + semesterNames.get(semester).en
		);
		writeFileSync(
			join(yearSemesterPath, 'he'),
			year + ' ' + semesterNames.get(semester).he
		);

		const orgId = catalog.OrgId;
		const orgPath = join(yearSemesterPath, orgId);
		mkdirSync(orgPath, { recursive: true });

		writeFileSync(join(orgPath, 'en'), catalog.OrgText.en);
		writeFileSync(join(orgPath, 'he'), catalog.OrgText.he);

		const orgTracks = catalog.tree.children?.at(0);
		if (orgTracks === undefined) {
			console.error('No tracks found for', catalog.Otjid);
			continue;
		}

		const orgTracksPath = join(orgPath, `${catalog.Otjid}_${orgTracks.Otjid}`);
		mkdirSync(join(orgTracksPath, 'requirement'), { recursive: true });

		writeFileSync(join(orgTracksPath, 'en'), catalog.ZzQualifications.en);
		writeFileSync(join(orgTracksPath, 'he'), catalog.ZzQualifications.he);
		writeFileSync(
			join(orgTracksPath, 'requirement', 'en'),
			catalog.ZzQualifications.en
		);
		writeFileSync(
			join(orgTracksPath, 'requirement', 'he'),
			catalog.ZzQualifications.he
		);

		for (const track of orgTracks.children ?? []) {
			writeTreeSync(join(orgTracksPath, 'requirement'), track);
		}
	}
}

main();
