import { json } from '@sveltejs/kit';
import {
	getConnections,
	getName,
	getPoints,
	getStudentsPage
} from '$lib/server/courseInfo.js';
import { getMedian } from '$lib/server/courseMedian.js';

export const GET = async ({ params: { code } }) => {
	const studentPage = await getStudentsPage(code);

	const info: Course = {
		code,
		median: await getMedian(code),
		points: getPoints(studentPage),
		name: getName(studentPage),
		connections: getConnections(studentPage)
	};

	return json(info);
};
