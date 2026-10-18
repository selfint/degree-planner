import { courseData } from '../../../.storybook/fixtures';

// Fictional overflow records stay local to the rail stories. No public data loads.
export const railCourses: FullCourse[] = Array.from(
	{ length: 7 },
	(_, index) => ({
		code: `0000010${index + 1}` as CourseCode,
		name: `Example relation ${index + 1} · קורס לדוגמה ${index + 1}`,
		points: 4,
		median: 86 - index,
		current: true,
		connections: { dependencies: [], adjacent: [], exclusive: [] }
	})
);
export const railCourseData = {
	...courseData,
	...Object.fromEntries(railCourses.map((course) => [course.code, course]))
} as CourseData;
export const getRailCourseData: GetCourseData = async (code) =>
	railCourseData[code] ?? { code, name: 'Unknown fictional course' };
