import { courseData } from '../../../.storybook/fixtures';

// Fictional overflow records stay local to the rail stories. No public data loads.
// Deliberately varied name lengths exercise natural equal-height row stretching.
export const railCourses: FullCourse[] = Array.from(
	{ length: 7 },
	(_, index) => ({
		code: `0000010${index + 1}` as CourseCode,
		name:
			index === 0
				? 'Example A · א'
				: index === 1
					? 'Example advanced systems and computational methods · מערכות ושיטות חישוב לדוגמה'
					: `Example relation ${index + 1} · קורס לדוגמה ${index + 1}`,
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
