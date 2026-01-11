/// <reference path="./types.d.ts"/>

import * as fs from 'fs';
import { join, dirname, basename } from 'path';
import * as sap from './SAPClient.mjs';

const DB_PATH = join(process.cwd(), 'static', '_catalogs');

/**
 * @param {string} path
 * @param {string} data
 */
function writeFileSync(path, data) {
	const size = sap.formatBytes(new Blob([data]).size);
	console.error('Writing', path, `(${size})`);
	fs.writeFileSync(path, data, 'utf-8');
}

/**
 * @param {string} dir
 */
function dirToJson(dir) {
	const subDirs = [];
	const files = [];
	for (const child of fs.readdirSync(dir)) {
		if (child === 'degree.json') {
			continue;
		}
		const childPath = join(dir, child);
		if (fs.statSync(childPath).isDirectory()) {
			subDirs.push([child, dirToJson(childPath)]);
		} else {
			let childContent = fs.readFileSync(childPath).toString();
			if (child === 'courses') {
				childContent = childContent.split('\n');
			}
			files.push([child, childContent]);
		}
	}

	return {
		...Object.fromEntries(subDirs),
		...Object.fromEntries(files)
	};
}

/**
 * @param {string} db_path
 */
function getDegrees(db_path) {
	const getSubdirs = (d) =>
		fs
			.readdirSync(d)
			.map((sub) => join(d, sub))
			.filter((sub) => fs.statSync(sub).isDirectory());

	return (
		// years
		getSubdirs(db_path)
			// semesters
			.flatMap(getSubdirs)
			// faculties
			.flatMap(getSubdirs)
			// requirements
			.flatMap(getSubdirs)
			.filter((d) => basename(d) == 'requirement')
	);
}

function main() {
	for (const degree of getDegrees(DB_PATH)) {
		writeFileSync(
			join(dirname(degree), 'requirementsData.json'),
			JSON.stringify(dirToJson(degree))
		);
	}
}

main();
