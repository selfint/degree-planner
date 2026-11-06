import type { LayoutLoad } from './$types';
import { loadPublicJson } from '$lib/publicData';

export const load: LayoutLoad = async ({ fetch }) => {
	const fullCourseData = loadPublicJson<Record<string, FullCourse>>(
		'/courseData.json',
		fetch
	).then((courses) => Object.values(courses));

	return {
		fullCourseData: fullCourseData
	};
};
