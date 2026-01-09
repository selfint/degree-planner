/// <reference path="./types.d.ts"/>

import * as fs from 'fs';
import { join, dirname } from 'path';
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

function main() {
	const degrees = fs.globSync(`${DB_PATH}/*/*/*/requirement`);
	for (const degree of degrees) {
		writeFileSync(
			join(dirname(degree), 'requirementsData.json'),
			JSON.stringify(dirToJson(degree))
		);
	}
}

main();
