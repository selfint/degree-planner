import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch }) => {
	const fullCourseData: Promise<FullCourse[]> = fetch('/courseData.json')
		.then((r) => r.json())
		.then((c) => Object.values(c));

	return {
		fullCourseData: fullCourseData
	};
};
