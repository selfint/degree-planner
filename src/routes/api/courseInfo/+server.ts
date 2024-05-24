import { error, json } from '@sveltejs/kit';
import { getConnections, getName, getStudentsPage } from '$lib/server/courseInfo.js';
import { getMedian } from '$lib/server/courseMedian.js';

export const GET = async ({ url }) => {
	const code = url.searchParams.get('c');
	if (code === null) {
		return error(422, 'Missing c (code) query parameter');
	}

	const studentPage = await getStudentsPage(code);

	const info: CourseInfo = {
		median: await getMedian(code),
		name: await getName(code, studentPage),
		connections: await getConnections(studentPage)
	};

	return json(info);
};
