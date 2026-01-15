/// <reference path="./types.d.ts"/>
/// <reference path="../src/app.d.ts"/>

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

const COURSE_DATA = join(process.cwd(), 'static', 'courseData.json');
const DB_PATH = join(process.cwd(), 'static', '_courses');

async function main() {
	mkdirSync(DB_PATH, { recursive: true });

	/** @type {Record<string, Course>} */
	const courses = JSON.parse(readFileSync(COURSE_DATA, 'utf-8'));

	for (const course of Object.values(courses)) {
		console.log('Writing course:', course.code);
		writeFileSync(join(DB_PATH, course.code), JSON.stringify(course));
	}
}

main();
