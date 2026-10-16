// Frozen pre-migration filesystem implementation. Used only as an independent
// same-input compatibility oracle; production never imports this module.
import {
	readdirSync,
	statSync,
	writeFileSync as _writeFileSync,
	readFileSync,
	mkdirSync
} from 'node:fs';
import * as fs from 'node:fs';
import { join, basename } from 'node:path';
import * as sap from '../SAPClient.mjs';
function writeFileSync(path, data) {
	_writeFileSync(path, data, 'utf8');
}
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

/**
 * @param {string} dir
 * @returns {Requirement}
 */
function dirToJson(dir) {
	const subDirs = [];
	const files = [];
	for (const child of fs.readdirSync(dir)) {
		if (child === 'requirementsData.json') {
			continue;
		}
		const childPath = join(dir, child);
		if (fs.statSync(childPath).isDirectory()) {
			subDirs.push(dirToJson(childPath));
		} else {
			let childContent = fs.readFileSync(childPath).toString();
			if (child === 'courses') {
				childContent = childContent.split('\n');
			}
			files.push([child, childContent]);
		}
	}

	/** @type {Requirement} */
	const r = {
		name: basename(dir),
		nested: subDirs,
		...Object.fromEntries(files)
	};

	return r;
}

function parseI18N(path) {
	const en = readFileSync(join(path, 'en')).toString();
	const he = readFileSync(join(path, 'he')).toString();

	return {
		en,
		he
	};
}

function parseDir(path, depth) {
	if (depth === 0) {
		return {
			...parseI18N(path)
		};
	}

	const subdirs = readdirSync(path)
		.filter((s) => !['en', 'he'].includes(s))
		.map((s) => [s, parseDir(join(path, s), depth - 1)]);

	return {
		...parseI18N(path),
		...Object.fromEntries(subdirs)
	};
}

export function legacyCatalogData(rawCatalogs, directory) {
	for (const catalog of rawCatalogs) writeCatalog(directory, catalog);
	const catalogs = Object.fromEntries(
		readdirSync(directory).map((year) => [
			year,
			parseDir(join(directory, year), 2)
		])
	);
	const requirements = new Map();
	for (const year of readdirSync(directory)) {
		for (const faculty of readdirSync(join(directory, year)).filter(
			(s) => !['en', 'he'].includes(s)
		)) {
			for (const program of readdirSync(join(directory, year, faculty)).filter(
				(s) => !['en', 'he'].includes(s)
			)) {
				const key = `${year}/${faculty}/${program}`;
				requirements.set(key, dirToJson(join(directory, key, 'requirement')));
			}
		}
	}
	return { catalogs, requirements };
}
