import fs from 'fs/promises';
import path from 'path';

import { describe, it, vi, beforeEach, afterEach } from 'vitest';

import manifest from '$lib/assets/manifest.json';
import {
	loadDegreeRequirements,
	loadDegreeRecommendation
} from './requirements';

describe('Requirements parser', () => {
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

	it('should parse recommended', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '3_year'];
		const header: Record<string, null> =
			// @ts-expect-error
			manifest[degree[0]][degree[1]][degree[2]].recommended;

		const requirements = await loadDegreeRecommendation(degree, header);

		ctx.expect(requirements).toMatchSnapshot();
	});

	it('should parse requirements', async (ctx) => {
		const degree: Degree = ['2023_2024', 'computer_science', '3_year'];
		const header: RequirementsHeader =
			// @ts-expect-error
			manifest[degree[0]][degree[1]][degree[2]].requirements;

		const requirements = await loadDegreeRequirements(degree, header);

		ctx.expect(requirements).toMatchSnapshot();
	});
});
