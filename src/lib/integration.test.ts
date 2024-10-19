import fs from 'fs/promises';
import path from 'path';
import { describe, it, vi, beforeEach, afterEach } from 'vitest';

import { getProgress } from './progress';
import { loadCatalog } from './requirements';
import { getCourseData } from './courseData';

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

		const data = await loadCatalog(degree);

		const progress = getProgress(
			data.recommended.map((s) => s.map(getCourseData)),
			data.requirement
		);

		ctx.expect(progress).toMatchSnapshot();
	});
});
