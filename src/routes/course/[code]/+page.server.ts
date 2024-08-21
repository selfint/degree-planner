const cacheRoute = '/_cache/courseData/';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const code = params.code;

	const course: Promise<Course> = fetch(cacheRoute + code + '.json')
		.then((res) => {
			if (res.ok) {
				return res.json();
			} else {
				throw new Error('failed fetching cached course data for ' + code);
			}
		})
		.catch(() => fetch(`/api/courseInfo/${code}`).then((res) => res.json()));

	return {
		course: course
	};
};
