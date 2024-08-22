import fs from 'fs/promises';
import path from 'path';
import { describe, it, vi, beforeEach, afterEach } from 'vitest';

import { getProgress } from './progress';
import { loadDegreeData } from './requirements';

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

		const data = await loadDegreeData(degree);

		const progress = await getProgress(
			data.recommended,
			cachedCourseData,
			data.requirements
		);

		ctx.expect(progress).toMatchSnapshot();
	});
});
