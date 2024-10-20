import fs from 'fs/promises';
import path from 'path';

import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';

import {
	getDegreeRequirementCourses,
	loadCatalog,
	parseCatalog
} from './requirements';

describe('Catalog Parser', () => {
	it('parses 5 digit courses', () => {
		expect(parseCatalog('12345')).toStrictEqual(['00120345']);
	});

	it('removes duplicates', () => {
		const text = '123456 123456';
		const codes = ['01230456'];

		expect(parseCatalog(text)).toStrictEqual(codes);
	});

	it('parses correctly', () => {
		const text = `'קנ
    236306 םיירקמ םיפרג 2.0
    236309 הניפצה תרותל אובמ 3.0
    236313 תויכוביסה תרות 3.0
    236315 בשחמה יעדמב תוירבגלא תוטיש 3.0
    236318 תוינאילוב תויצקנופ לש הזילנא 2.0
    236359 םימתירוגלא 2 3.0
    236374 םימתירוגלאו תויתורבתסה תוטיש 3.0
    236377 םיפרגב םירזובמ םימתירוגלא 3.0
    236378 לוהינ תונורקע תואדו רסח עדימ 2.0
    236508 תויכוביסו היפרגוטפירק 2.0
    236518 תרושקת תויכוביס 2.0
    236521 ק ימתירוגלא י בור 2.0
    236525`;
		const codes = [
			'02360306',
			'02360309',
			'02360313',
			'02360315',
			'02360318',
			'02360359',
			'02360374',
			'02360377',
			'02360378',
			'02360508',
			'02360518',
			'02360521',
			'02360525'
		];
		expect(parseCatalog(text)).toStrictEqual(codes);
	});
});

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

describe('Requirements', () => {
	it('should provide a list of requirements and their courses', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '3_year'];

		const data = await loadCatalog(degree, localFetch);

		const requirementsCourses = getDegreeRequirementCourses(data.requirement);

		ctx
			.expect(
				requirementsCourses.map((r) => ({
					path: r.path.map((p) => p.name),
					courses: r.courses.length
				}))
			)
			.toMatchSnapshot();
	});

	it('should parse recommended', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '3_year'];

		const requirements = await loadCatalog(degree, localFetch);

		ctx.expect(requirements.recommended).toMatchSnapshot();
	});

	it('should parse requirements', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '3_year'];

		const data = await loadCatalog(degree, localFetch);

		ctx.expect(data.requirement).toMatchSnapshot();
	});
});
