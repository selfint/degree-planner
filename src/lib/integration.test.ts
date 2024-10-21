import fs from 'fs/promises';
import path from 'path';
import { describe, it } from 'vitest';

import { getProgress, requirementCompleted } from './progress';
import { loadCatalog, parseCatalog } from './requirements';
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

describe('Integration', () => {
	it('should work with CS degree', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '3_year'];

		const data = await loadCatalog(degree, localFetch);

		const progress = getProgress(
			data.recommended.map((s) => s.map(getCourseData)),
			data.requirement
		);

		ctx.expect(progress).toMatchSnapshot();
	});
});

describe('CS 4 year degree', () => {
	it('should only count specialization points from completed specializations', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '4_year'];

		function buildSemesters(semesters: string[][]): Course[][] {
			return semesters.map((semester) => semester.map(getCourseData));
		}

		const data = await loadCatalog(degree, localFetch);

		const specialization = data.requirement.nested
			?.find((r) => r.name === 'list_a')
			?.nested?.find((r) => r.name === 'specialization');

		ctx.expect(specialization?.strict).toEqual('points');

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
