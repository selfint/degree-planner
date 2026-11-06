import { describe, expect, it } from 'vitest';

import { getScheduleError } from './schedule';

// Scheduling accepts persisted identifiers even when they are absent from the
// current public catalog. Keep these fixtures independent of its snapshot.
const localGetCourseData: GetCourseData = async (code) => ({ code });

describe('Schedule', () => {
	it('keeps unknown persisted prerequisites in schedule errors', async () => {
		const course: Course = {
			code: '09999998',
			connections: {
				dependencies: [['09999999']],
				adjacent: [],
				exclusive: []
			}
		};

		expect(
			await getScheduleError(localGetCourseData, course, [], [[]], 0)
		).toEqual({
			dependencies: [[{ course: { code: '09999999' }, taken: false }]],
			adjacencies: [],
			exclusives: [],
			season: undefined
		});
		expect(
			await getScheduleError(localGetCourseData, course, [], [[]], 0, true)
		).toEqual({
			dependencies: [],
			adjacencies: [],
			exclusives: [],
			season: undefined
		});
	});

	it('should account for exemptions', async () => {
		const course: Course = {
			code: '2',
			connections: {
				dependencies: [['1']],
				adjacent: [],
				exclusive: []
			}
		};

		expect(await getScheduleError(localGetCourseData, course, ['1'], [], 0))
			.toMatchInlineSnapshot(`
			{
			  "adjacencies": [],
			  "dependencies": [],
			  "exclusives": [],
			  "season": undefined,
			}
		`);
	});

	it('should check the season', async () => {
		const course: Course = {
			code: '1',
			seasons: ['Spring']
		};

		expect(await getScheduleError(localGetCourseData, course, [], [], 0))
			.toMatchInlineSnapshot(`
			{
			  "adjacencies": [],
			  "dependencies": [],
			  "exclusives": [],
			  "season": [
			    1,
			  ],
			}
		`);

		expect(await getScheduleError(localGetCourseData, course, [], [], 1))
			.toMatchInlineSnapshot(`
			{
			  "adjacencies": [],
			  "dependencies": [],
			  "exclusives": [],
			  "season": undefined,
			}
		`);
	});
});
