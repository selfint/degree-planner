// All identifiers and content are fictional. This file never imports public datasets.
export const courses: FullCourse[] = [
	{
		code: '00000001' as CourseCode,
		name: 'Example foundations · יסודות לדוגמה',
		points: 4,
		median: 86,
		current: true,
		faculty: 'Example science',
		about: 'A fictional introduction for component review.',
		seasons: ['Winter', 'Spring'],
		tests: [
			{ year: 2026, monthIndex: 6, day: 1 },
			{ year: 2026, monthIndex: 7, day: 1 }
		],
		connections: { dependencies: [], adjacent: [], exclusive: [] }
	},
	{
		code: '00000002' as CourseCode,
		name: 'Example systems · מערכות לדוגמה',
		points: 3,
		median: 78,
		current: true,
		faculty: 'Example engineering',
		about: 'A fictional follow-up course.',
		seasons: ['Spring'],
		tests: [
			{ year: 2026, monthIndex: 6, day: 8 },
			{ year: 2026, monthIndex: 7, day: 9 }
		],
		connections: {
			dependencies: [['00000001' as CourseCode]],
			adjacent: [],
			exclusive: []
		}
	},
	{
		code: '00000003' as CourseCode,
		name: 'Example project · פרויקט לדוגמה',
		points: 2,
		median: 92,
		current: false,
		faculty: 'Example science',
		seasons: ['Summer'],
		connections: { dependencies: [], adjacent: [], exclusive: [] }
	}
];
export const courseData = Object.fromEntries(
	courses.map((c) => [c.code, c])
) as CourseData;
export const getCourseData: GetCourseData = async (code) =>
	courseData[code] ?? { code, name: 'Unknown fictional course' };
export const pending = <T>(): Promise<T> => new Promise(() => {});
export const sampleDegree = ['2099', 'example', 'demo'] as unknown as Degree;
export const catalogs = {
	'2099': {
		en: '2099',
		he: '2099',
		example: {
			en: 'Example faculty',
			he: 'פקולטה לדוגמה',
			demo: { en: 'Example degree', he: 'תואר לדוגמה' }
		}
	}
} as unknown as Catalogs;
export const requirementFixture: Requirement = {
	name: 'example',
	en: 'Example degree',
	he: 'תואר לדוגמה',
	points: 9,
	nested: [
		{
			name: 'core',
			en: 'Core courses',
			he: 'קורסי חובה',
			courses: [courses[0].code, courses[1].code],
			points: 7,
			count: 2
		},
		{
			name: 'electives',
			en: 'Electives',
			he: 'בחירה',
			courses: [courses[2].code],
			points: 2,
			count: 1
		}
	]
};
export const emptySchedule: ScheduleError = {
	dependencies: [],
	adjacencies: [],
	exclusives: []
};
export const scheduleFixture: ScheduleError = {
	dependencies: [[{ course: courses[0], taken: false }]],
	adjacencies: [{ course: courses[1], taken: false }],
	exclusives: [courses[2]],
	season: [0, 1]
};
export const makeUser = (empty = false): UserData => ({
	semesters: empty ? [[], [], []] : [[courses[0].code], [courses[1].code], []],
	exemptions: [],
	wishlist: empty ? [] : [courses[2].code],
	currentSemester: 1,
	degree: sampleDegree
});
