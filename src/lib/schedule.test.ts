import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { getScheduleError } from './schedule';

const COURSE_DATA = JSON.parse(
	fs
		.readFileSync(path.join(process.cwd(), 'static', 'courseData.json'))
		.toString()
);

async function localGetCourseData(code: string): Promise<Course> {
	return COURSE_DATA[code] || { code };
}

describe('Schedule', () => {
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
