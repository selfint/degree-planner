import fs from 'fs/promises';
import path from 'path';
import { describe, it } from 'vitest';

import { getProgress, requirementCompleted } from './progress';
import { loadCatalog } from './requirements';
import { getCourseData } from './courseData';

async function localFetch(
	input: string | URL | globalThis.Request,
	init?: RequestInit
): Promise<Response> {
	// assert input is string
	if (typeof input !== 'string') {
		throw new Error('Only string input is supported');
	}

	const base = path.join(process.cwd(), 'static');
	const filepath = path.join(base, input);

	// read the file
	const text = await fs.readFile(filepath).then((buf) => buf.toString());

	return new Response(text);
}

function replaceMedian(obj: unknown): unknown {
	if (Array.isArray(obj)) {
		// Traverse arrays
		return obj.map(replaceMedian);
	} else if (obj && typeof obj === 'object') {
		// Traverse objects
		for (const key in obj) {
			// @ts-expect-error
			if (key === 'median' && typeof obj[key] === 'number') {
				// Replace the "median" field
				// @ts-expect-error
				obj[key] = '<number>';
			} else {
				// Recurse on nested objects
				// @ts-expect-error
				obj[key] = replaceMedian(obj[key]);
			}
		}
	}
	return obj;
}

describe('Integration', () => {
	it('should work with CS degree', async (ctx) => {
		const degree: Degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];
		const path = 'CG00006246';

		const data = await loadCatalog(degree, path, localFetch);

		const semesters = [
			['01040031', '01040166', '02340114', '02340129', '03240033']
		].map((s) => s.map(getCourseData));

		const progress = getProgress(semesters, data.requirement);

		console.dir(progress);
		console.log('done');
		console.error('done');

		function formatProgress(p: Progress): unknown {
			if (typeof p.courses.done !== 'number') {
				p.courses.done = p.courses.done?.length;
			}
			if (typeof p.courses.options !== 'number') {
				p.courses.options = p.courses.options?.length;
			}
			p.nested.done = p.nested.done?.map(formatProgress);
			p.nested.options = p.nested.options?.map(formatProgress);

			return p;
		}

		ctx.expect(formatProgress(progress)).toMatchSnapshot();
	});
});

describe('CS 4 year degree', () => {
	it.skip('should only count specialization points from completed specializations', async (ctx) => {
		const degree: Degree = ['2024_200', '00002120', 'SC00001313_CG00006209'];
		const path = 'CG00006210';

		function buildSemesters(semesters: string[][]): Course[][] {
			return semesters.map((semester) => semester.map(getCourseData));
		}

		const data = await loadCatalog(degree, path, localFetch);

		const specialization = data.requirement.nested
			?.find((r) => r.name === 'list_a')
			?.nested?.find((r) => r.name === 'specialization');

		function parseCatalog(text) {
			const regex = /\b\d{5,6}\b/g;
			const matches = text.match(regex);

			const codes = [...new Set(matches ? matches : [])];
			return codes
				.map((code) => code.replace(/^0+/, ''))
				.map((code) => '0'.repeat(6 - code.length) + code)
				.map((code) => '0' + code.slice(0, 3) + '0' + code.slice(3));
		}

		const chosenSpecializations = parseCatalog(`
			1 סיבוכיות של חישובים נק'
			236306 גרפים מקריים 2.0
			236309 מבוא לתורת הצפינה 3.0
			236313 תורת הסיבוכיות 3.0


			2 תורת האלגוריתמים
			236521 אלגוריתמי ק י רוב 2.0
			236377 אלגוריתמים מבו זרים בגרפים 3.0
			236359 אלגוריתמים 2 3.0


			3 לוגיקה ויישומיה
			236025 אוטומטים, לוגיקה ומשחקים 2.0
			236026 ידע ומשחקים במערכות מבוזרות 2.0
			236304 לוגיקה למדעי המחשב 2 3.0
		`);

		const other = parseCatalog(`
			5 פיתוח מערכות תוכנה
			236268 ארכיטקטורת מעבדים בגישה בונה 3.0
			236271 פיתוח מבוסס אנדרואיד 2.0
		`);

		ctx.expect(chosenSpecializations).toHaveLength(9);
		ctx
			.expect([...new Set([...chosenSpecializations, ...other])].length)
			.toEqual(11);

		const expectedPoints = chosenSpecializations
			.map(getCourseData)
			.reduce((acc, course) => acc + (course.points ?? 0), 0);

		ctx.expect(expectedPoints, 'Points to match').toEqual(23);

		const progress = getProgress(
			buildSemesters([chosenSpecializations, other]),
			specialization!
		);

		ctx.expect(progress.points).toMatchInlineSnapshot(`
			{
			  "done": 23,
			  "required": 26,
			}
		`);
		ctx.expect(progress.count).toMatchInlineSnapshot(`
			{
			  "done": 9,
			  "required": 0,
			}
		`);
		ctx.expect(progress.amount).toMatchInlineSnapshot(`
			{
			  "done": 3,
			  "required": 3,
			}
		`);
		ctx.expect(progress.nested.done.map(({ name }) => name))
			.toMatchInlineSnapshot(`
			[
			  "algorithm_theory",
			  "applied_logic",
			  "computation_complexity",
			]
		`);
		ctx.expect(requirementCompleted(progress)).toEqual(false);
	});
});
