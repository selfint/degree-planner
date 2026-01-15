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
const STRIPPED_COURSE_DATA = join(
	process.cwd(),
	'static',
	'courseDataStripped.json'
);

/**
 *
 * @param {FullCourse} course
 * @returns {Course}
 */
function stripCourse(course) {
	delete course.about;
	delete course.faculty;

	return course;
}

async function main() {
	/** @type {Record<string, FullCourse>} */
	const courses = JSON.parse(readFileSync(COURSE_DATA, 'utf-8'));

	for (const course of Object.values(courses)) {
		courses[course.code] = stripCourse(course);
	}

	writeFileSync(STRIPPED_COURSE_DATA, JSON.stringify(courses));
}

main();
