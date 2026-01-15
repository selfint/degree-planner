import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch }) => {
	const courseData: Promise<CourseData> = fetch(
		'/courseDataStripped.json'
	).then((r) => r.json());

	async function getCourseData(code: CourseCode): Promise<Course> {
		const data = await courseData;

		return data[code] || { code };
	}

	return {
		courseData,
		getCourseData
	};
};
