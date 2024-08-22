import fs from 'fs/promises';
import path from 'path';

import { describe, it, vi, beforeEach, afterEach } from 'vitest';

import { getDegreeRequirementCourses, loadDegreeData } from './requirements';

describe('Requirements', () => {
	beforeEach(() => {
		// @ts-expect-error
		global.fetch = vi.fn(async (url: string) => {
			const base = path.join(process.cwd(), 'static');
			const filepath = path.join(base, url);

			return {
				ok: true,
				text: async () => fs.readFile(filepath).then((buf) => buf.toString())
			};
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should provide a list of requirements and their courses', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '3_year'];

		const data = await loadDegreeData(degree);

		const requirementsCourses = getDegreeRequirementCourses(data.requirements);

		ctx
			.expect(
				requirementsCourses.map((r) => ({
					path: r.path,
					courses: r.courses.length
				}))
			)
			.toMatchSnapshot();
	});

	it('should parse recommended', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '3_year'];

		const requirements = await loadDegreeData(degree);

		ctx.expect(requirements.recommended).toMatchSnapshot();
	});

	it('should parse requirements', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '3_year'];

		const data = await loadDegreeData(degree);

		ctx.expect(data.requirements).toMatchSnapshot();
	});
});
