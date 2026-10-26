import fs from 'fs/promises';
import path from 'path';

import { describe, expect, it, vi } from 'vitest';

import catalogs from '../../static/catalogs.json';
import {
	getDegreeRequirementCourses,
	loadCatalog,
	loadDegreeName
} from './requirements';

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
	it.each(['en', 'he'] as const)(
		'loads degree names from JSON in %s without legacy text leaves',
		async (lang) => {
			const degree: Degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];
			const fetchJson = vi.fn(localFetch);
			const name = await loadDegreeName(
				lang,
				'catalog',
				degree,
				undefined,
				fetchJson
			);
			const year = catalogs[degree[0]];
			const faculty = year[degree[1]];
			const program = faculty[degree[2]];
			expect(name).toBe(
				`${faculty[lang]} (catalog ${year[lang]}) - ${program[lang]}`
			);
			expect(fetchJson.mock.calls.map(([url]) => url)).toEqual([
				'/catalogs.json'
			]);
		}
	);

	it('uses the selected path label from requirement JSON for existing shared plan URLs', async () => {
		const degree: Degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];
		const fetchJson = vi.fn(localFetch);
		const name = await loadDegreeName(
			'en',
			'catalog',
			degree,
			'CG00006253',
			fetchJson
		);
		expect(name).toContain('catalog 2024 Winter');
		expect(fetchJson.mock.calls.map(([url]) => url).sort()).toEqual([
			'/_catalogs/2024_200/00002120/SC00001314_CG00006245/requirementsData.json',
			'/catalogs.json'
		]);
		const requirement = JSON.parse(
			await fs.readFile(
				'static/_catalogs/2024_200/00002120/SC00001314_CG00006245/requirementsData.json',
				'utf8'
			)
		);
		expect(
			name.endsWith(
				requirement.nested.find(
					(node: Requirement) => node.name === 'CG00006253'
				).en
			)
		).toBe(true);
	});

	it('reports unknown paths and failed manifest fetches instead of a broken label', async () => {
		const degree: Degree = ['2024_200', '00002120', 'SC00001314_CG00006245'];
		await expect(
			loadDegreeName('en', 'catalog', degree, 'missing', localFetch)
		).rejects.toThrow('Unknown degree path');
		await expect(
			loadDegreeName(
				'en',
				'catalog',
				degree,
				undefined,
				async () => new Response('', { status: 503 })
			)
		).rejects.toThrow('Failed to load catalogs (503)');
	});

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
