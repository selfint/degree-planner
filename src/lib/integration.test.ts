import fs from 'fs/promises';
import path from 'path';
import { describe, it, vi, beforeEach, afterEach } from 'vitest';

import manifest from '$lib/assets/manifest.json';

import { getProgress } from './progress';
import {
	loadDegreeRequirements,
	loadDegreeRecommendation
} from './requirements';

const cacheDir = path.resolve('static', '_cache', 'courseData');
const cachedCourseData = async (code: string): Promise<Course> => {
	const cached = path.join(cacheDir, `${code}.json`);
	const data = await fs.readFile(cached);

	return JSON.parse(data.toString());
};

describe('Integration', () => {
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

	it('should work with CS degree', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '3_year'];

		const recommendedHeader: Record<string, null> =
			// @ts-expect-error
			manifest[degree[0]][degree[1]][degree[2]].recommended;

		const requirementsHeader: RequirementsHeader =
			// @ts-expect-error
			manifest[degree[0]][degree[1]][degree[2]].requirements;

		const recommended = await loadDegreeRecommendation(
			degree,
			recommendedHeader
		);
		const requirements = await loadDegreeRequirements(
			degree,
			requirementsHeader
		);

		const progress = await getProgress(
			recommended,
			cachedCourseData,
			requirements
		);

		ctx.expect(progress).toMatchSnapshot();
	});
});
