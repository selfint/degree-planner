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

	const classification = '01130013';
	const physics = '01140077';
	const mechanics: Course = {
		code: '00140102',
		connections: {
			dependencies: [[classification], [physics]],
			adjacent: [],
			exclusive: []
		}
	};
	const lookup: GetCourseData = async (code) =>
		code === physics ? { code, name: 'Physics 1L' } : { code };

	it.each([
		['classification exemption', [classification], [[], []]],
		['classification in an earlier semester', [], [[classification], []]],
		['Physics 1L in an earlier semester', [], [[physics], []]],
		['both alternatives', [classification], [[physics], []]]
	] as const)(
		'accepts either complete alternative on both surfaces: %s',
		async (_, exemptions, semesters) => {
			for (const ignoreUndefined of [false, true]) {
				expect(
					(
						await getScheduleError(
							lookup,
							mechanics,
							[...exemptions],
							semesters.map((s) => [...s]),
							1,
							ignoreUndefined
						)
					).dependencies
				).toEqual([]);
			}
		}
	);

	it('does not treat the unavailable catalog record as an exemption', async () => {
		const plan = await getScheduleError(lookup, mechanics, [], [[], []], 1);
		const suggestions = await getScheduleError(
			lookup,
			mechanics,
			[],
			[[], []],
			1,
			true
		);

		expect(
			plan.dependencies.map((g) => g.map(({ course }) => course.code))
		).toEqual([[classification], [physics]]);
		expect(
			suggestions.dependencies.map((g) => g.map(({ course }) => course.code))
		).toEqual([[physics]]);
	});

	it('does not clear another alternative after only part of an unnamed group is satisfied', async () => {
		const otherClassification = '09999999';
		const course: Course = {
			...mechanics,
			connections: {
				...mechanics.connections!,
				dependencies: [[classification, otherClassification], [physics]]
			}
		};
		const result = await getScheduleError(
			lookup,
			course,
			[classification],
			[[], []],
			1,
			true
		);

		expect(
			result.dependencies.map((g) => g.map(({ course }) => course.code))
		).toEqual([[physics]]);
	});

	it('preserves existing mixed-group advisory behavior for unresolved unnamed requirements', async () => {
		const course: Course = {
			...mechanics,
			connections: {
				...mechanics.connections!,
				dependencies: [[classification, physics]]
			}
		};
		const missing = await getScheduleError(
			lookup,
			course,
			[],
			[[], []],
			1,
			true
		);
		expect(
			missing.dependencies.map((g) => g.map(({ course }) => course.code))
		).toEqual([[physics]]);

		const semesters = [[physics], []];
		const plan = await getScheduleError(lookup, course, [], semesters, 1);
		const suggestions = await getScheduleError(
			lookup,
			course,
			[],
			semesters,
			1,
			true
		);
		expect(plan.dependencies.flat().map(({ taken }) => taken)).toEqual([
			false,
			true
		]);
		expect(suggestions.dependencies).toEqual([]);
	});

	it('recognizes the code-only exemption in released Construction Materials prerequisites', async () => {
		// Relevant fields from main ea22a7e's static/courseData.json.
		// 01250011 has no record; 01250001 is General Chemistry.
		const otherChemistry = '01250011';
		const generalChemistry = '01250001';
		const course: Course = {
			code: '00140505',
			connections: {
				dependencies: [[otherChemistry], [generalChemistry]],
				adjacent: [],
				exclusive: []
			}
		};
		const lookup: GetCourseData = async (code) =>
			code === generalChemistry ? { code, name: 'כימיה כללית' } : { code };
		for (const ignoreUndefined of [false, true]) {
			const result = await getScheduleError(
				lookup,
				course,
				[otherChemistry],
				[[]],
				0,
				ignoreUndefined
			);
			expect(result.dependencies).toEqual([]);
		}
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
