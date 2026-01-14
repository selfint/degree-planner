import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data }) => {
	const { courseData } = data;

	async function getCourseData(code: CourseCode): Promise<Course> {
		const data = await courseData;

		return data[code] || { code };
	}

	return {
		getCourseData,
		...data
	};
};
