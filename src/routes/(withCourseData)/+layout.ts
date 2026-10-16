import type { LayoutLoad } from './$types';
import { loadPublicJson } from '$lib/publicData';

export const load: LayoutLoad = async ({ fetch }) => {
	const courseData = loadPublicJson<CourseData>(
		'/courseDataStripped.json',
		fetch
	);

	async function getCourseData(code: CourseCode): Promise<Course> {
		const data = await courseData;

		return data[code] || { code };
	}

	return {
		courseData,
		getCourseData
	};
};
