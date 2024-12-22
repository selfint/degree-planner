import { describe, it, expect } from 'vitest';

import { getScheduleError } from './schedule';

describe('Schedule', () => {
	it('should account for exemptions', () => {
		const course: Course = {
			code: '2',
			connections: {
				dependencies: [['1']],
				adjacent: [],
				exclusive: []
			}
		};

		expect(getScheduleError(course, ['1'], [], 0)).toMatchInlineSnapshot(`
			{
			  "adjacencies": [],
			  "dependencies": [],
			  "exclusives": [],
			  "season": undefined,
			}
		`);
	});

	it('should check the season', () => {
		const course: Course = {
			code: '1',
			seasons: ['Spring']
		};

		expect(getScheduleError(course, [], [], 0)).toMatchInlineSnapshot(`
			{
			  "adjacencies": [],
			  "dependencies": [],
			  "exclusives": [],
			  "season": [
			    1,
			  ],
			}
		`);

		expect(getScheduleError(course, [], [], 1)).toMatchInlineSnapshot(`
			{
			  "adjacencies": [],
			  "dependencies": [],
			  "exclusives": [],
			  "season": undefined,
			}
		`);
	});
});
