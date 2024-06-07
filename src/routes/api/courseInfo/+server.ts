import { error, json } from '@sveltejs/kit';
import {
	getConnections,
	getName,
	getPoints,
	getStudentsPage
} from '$lib/server/courseInfo.js';
import { getMedian } from '$lib/server/courseMedian.js';

export const GET = async ({ url }) => {
	const code = url.searchParams.get('c');
	if (code === null) {
		return error(422, 'Missing c (code) query parameter');
	}

	const studentPage = await getStudentsPage(code);

	const info = {
		median: await getMedian(code),
		points: getPoints(studentPage),
		name: getName(studentPage),
		connections: getConnections(studentPage)
	};

	return json(info);
};
