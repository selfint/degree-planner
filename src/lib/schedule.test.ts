import { describe, it, expect } from 'vitest';

import { getScheduleError } from './schedule';

describe('Schedule', () => {
	it('should check the season', async (ctx) => {
		const course: Course = {
			code: '1',
			seasons: ['Spring']
		};

		ctx.expect(await getScheduleError(course, [], 0)).toMatchInlineSnapshot(`
			{
			  "adjacencies": [],
			  "dependencies": [],
			  "exclusives": [],
			  "season": [
			    1,
			  ],
			}
		`);

		ctx.expect(await getScheduleError(course, [], 1)).toMatchInlineSnapshot(`
			{
			  "adjacencies": [],
			  "dependencies": [],
			  "exclusives": [],
			  "season": undefined,
			}
		`);
	});
});
