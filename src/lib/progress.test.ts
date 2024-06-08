import { describe, it } from 'vitest';

import { getProgress } from './progress';

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

describe('Progress', () => {
	it('should apply overflow', async (ctx) => {
		const semesters = [['1', '2']];
		const requirements: DegreeRequirements = {
			points: 0,
			requirements: new Map([
				[
					'core',
					{
						courses: ['1', '2'],
						points: 2,
						overflow: 'overflow_target'
					}
				],
				[
					'list a',
					{
						courses: ['1', '2'],
						count: 1,
						overflow: 'overflow_target'
					}
				],
				[
					'overflow_target',
					{
						points: 1
					}
				]
			])
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
			        "overflow": "overflow_target",
			        "points": 2,
			      },
			      {
			        "courses": [
			          "1",
			          "2",
			        ],
			        "points": 3,
			      },
			    ],
			    "list a" => [
			      {
			        "count": 1,
			        "courses": [
			          "1",
			          "2",
			        ],
			        "overflow": "overflow_target",
			      },
			      {
			        "count": 2,
			        "courses": [
			          "1",
			          "2",
			        ],
			      },
			    ],
			    "overflow_target" => [
			      {
			        "points": 1,
			      },
			      {
			        "count": 1,
			        "courses": [],
			        "points": 1,
			      },
			    ],
			  },
			}
		`);
	});

	it('should return choice progress', async (ctx) => {
		const semesters = [['1', '2']];
		const requirements: DegreeRequirements = {
			points: 0,
			requirements: new Map([
				[
					'core',
					{
						choice: {
							amount: 1,
							options: new Map([
								['option 1', { courses: ['1'], count: 1 }],
								['option 2', { courses: ['2'], count: 1 }]
							])
						}
					}
				]
			])
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
			        "choice": {
			          "amount": 1,
			          "options": Map {
			            "option 1" => {
			              "count": 1,
			              "courses": [
			                "1",
			              ],
			            },
			            "option 2" => {
			              "count": 1,
			              "courses": [
			                "2",
			              ],
			            },
			          },
			        },
			      },
			      {
			        "choice": {
			          "amount": 2,
			          "options": Map {
			            "option 1" => {
			              "count": 1,
			              "courses": [
			                "1",
			              ],
			            },
			            "option 2" => {
			              "count": 1,
			              "courses": [
			                "2",
			              ],
			            },
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	});
	it('should return count progress', async (ctx) => {
		const semesters = [['1', '2']];
		const requirements: DegreeRequirements = {
			points: 0,
			requirements: new Map([
				[
					'core',
					{
						courses: ['1', '2'],
						count: 1
					}
				]
			])
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
			        "count": 1,
			        "courses": [
			          "1",
			          "2",
			        ],
			      },
			      {
			        "count": 2,
			        "courses": [
			          "1",
			          "2",
			        ],
			      },
			    ],
			  },
			}
		`);
	});

	it('should return point progress', async (ctx) => {
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
