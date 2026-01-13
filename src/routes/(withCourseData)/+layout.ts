import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ data }) => {
	const { courseData } = data;

	async function getCourseData(code: CourseCode): Promise<Course> {
		const data = await courseData;
		const course = data[code] satisfies Course;

		return course || { code };
	}

	return {
		getCourseData,
		...data
	};
};
