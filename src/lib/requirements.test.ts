import fs from 'fs/promises';
import path from 'path';

import { describe, it } from 'vitest';

import catalogs from '../../static/catalogs.json';
import { getDegreeRequirementCourses, loadCatalog } from './requirements';

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
		const degree: Degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];

		const data = await loadCatalog(
			Promise.resolve(catalogs),
			degree,
			undefined,
			localFetch
		);

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
		const degree: Degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];

		const requirements = await loadCatalog(
			Promise.resolve(catalogs),
			degree,
			undefined,
			localFetch
		);

		ctx.expect(requirements.recommended).toMatchSnapshot();
	});

	it('should parse requirements', async (ctx) => {
		const degree: Degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];

		const data = await loadCatalog(
			Promise.resolve(catalogs),
			degree,
			undefined,
			localFetch
		);

		ctx.expect(data.requirement).toMatchSnapshot();
	});
});
