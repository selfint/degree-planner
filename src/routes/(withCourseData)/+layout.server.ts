import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ fetch }) => {
	return {
		courseData: fetch('/courseData.json').then(
			(r) => r.json() as unknown as CourseData
		)
	};
};
