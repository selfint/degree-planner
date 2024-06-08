import { describe, it } from 'vitest';

import { getProgress } from './progress';

describe('Progress', () => {
	it('should return progress', async (ctx) => {
		const semesters = [['1', '2']];
		const requirements: DegreeRequirements = {
			points: 0,
			requirements: new Map([
				[
					'core',
					{
						courses: ['1', '2'],
						points: 3
					}
				]
			])
		};

		type Course = {
			code: string;
			name?: string;
			points?: number;
			median?: number;
			connections?: CourseConnections;
		};

		const courseData = new Map([
			['1', { code: '1', points: 1 }],
			['2', { code: '2', points: 2 }]
		]);
		const getCourseData = async (code: string): Promise<Course> => {
			const data = courseData.get(code);
			if (data === undefined) {
				throw new Error(`Course ${code} not found`);
			}

			return data;
		};

		const progress = await getProgress(semesters, getCourseData, requirements);

		ctx.expect(progress).toMatchInlineSnapshot(`
			{
			  "points": [
			    3,
			    0,
			  ],
			  "requirements": Map {
			    "core" => [
			      {
			        "courses": [
			          "1",
			          "2",
			        ],
			        "points": 3,
			      },
			      {
			        "courses": [
			          "1",
			          "2",
			        ],
			        "points": 3,
			      },
			    ],
			  },
			}
		`);
	});
});
