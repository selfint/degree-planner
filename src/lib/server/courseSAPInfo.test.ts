import { describe, it, expect } from 'vitest';

import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
	getName,
	getConnections,
	getPoints,
	getAbout,
	getTests,
	getCourseInfo,
	getSeasons,
	type CourseSAPInfo
} from './courseSAPInfo';

function getDoc(): CourseSAPInfo {
	return JSON.parse(
		readFileSync(resolve(__dirname, 'course_02340218_sapInfo.json'), 'utf-8')
	);
}

describe('Course Info', () => {
	it('Handles multiple first exams', async (ctx) => {
		const info = await getCourseInfo('01140052');

		ctx.expect(info).toBeDefined();

		const tests = getTests(info!);

		ctx.expect(tests).toMatchInlineSnapshot(`
			[
			  {
			    "day": 12,
			    "monthIndex": 1,
			    "year": 2025,
			  },
			  {
			    "day": 7,
			    "monthIndex": 2,
			    "year": 2025,
			  },
			]
		`);
	});

	it('Gets the course info', async (ctx) => {
		const info = await getCourseInfo('02340218');
	});

	it('Gets the course seasons', () => {
		const doc = getDoc();

		const seasons = getSeasons(doc);

		expect(seasons).toMatchInlineSnapshot(`
			[
			  "Winter",
			  "Spring",
			  "Summer",
			]
		`);
	});

	it('Gets the course tests', () => {
		const doc = getDoc();

		const tests = getTests(doc);
		expect(tests).toMatchInlineSnapshot(`
			[
			  {
			    "day": 13,
			    "monthIndex": 1,
			    "year": 2025,
			  },
			  {
			    "day": 20,
			    "monthIndex": 2,
			    "year": 2025,
			  },
			]
		`);
	});

	it('Gets the course about', () => {
		const doc = getDoc();

		const about = getAbout(doc);
		expect(about).toMatchInlineSnapshot(
			`"הקורס יקנה ידע במבני נתונים בסיסיים, באנליזה, ביישומים ובשימושים שונים שלהם. יושם דגש על התאמת מבני הנתונים לצרכי הבעיה הנתונה. סוגי מבנים: חזרה על המבנים הפשוטים (מערכים, רשימות, מחסניות ותורים), רשימות דילוגים, תורי עדיפות, ערמות, עצים דיגיטלים ( SEIRT ). מיון וחיפוש. עצים וגרפים וייצוגיהם. הקצאת זכרון, ערבול, איסוף אשפה."`
		);
	});

	it('Gets the course points', async () => {
		const doc = getDoc();

		const points = getPoints(doc);
		expect(points).toMatchInlineSnapshot(`3`);
	});

	it('Gets the course name', async () => {
		const doc = getDoc();

		const name = getName(doc);

		expect(name).toMatchInlineSnapshot(`"מבני נתונים 1"`);
	});

	it('Get the course connections', async () => {
		const doc = getDoc();

		const connections = getConnections(doc);

		expect(connections).toMatchInlineSnapshot(`
			{
			  "adjacent": [],
			  "dependencies": [
			    [
			      "02340141",
			      "02340124",
			    ],
			    [
			      "02340124",
			      "01040286",
			    ],
			    [
			      "01040286",
			      "02340122",
			    ],
			    [
			      "02340122",
			      "02340141",
			    ],
			  ],
			  "exclusive": [],
			}
		`);
	});
});
