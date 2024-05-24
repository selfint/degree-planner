import { error, json } from '@sveltejs/kit';
import { getName, getStudentsPage } from '$lib/server/courseInfo.js';
import { getMedian } from '$lib/server/courseMedian.js';

export const GET = async ({ url }) => {
	const code = url.searchParams.get('c');
	if (code === null) {
		return error(422, 'Missing c (code) query parameter');
	}

	const studentPage = await getStudentsPage(code);

	const info: CourseInfo = {
		name: await getName(code, studentPage),
		median: await getMedian(code)
	};

	return json(info);
};
