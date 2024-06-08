import fs from 'fs/promises';
import path from 'path';

import { json } from '@sveltejs/kit';
import {
	getConnections,
	getName,
	getPoints,
	getStudentsPage
} from '$lib/server/courseInfo.js';
import { getMedian } from '$lib/server/courseMedian.js';

const cacheDir = path.resolve('static', '_cache', 'courseData');

export const GET = async ({ params: { code } }) => {
	const cached = path.join(cacheDir, `${code}.json`);

	try {
		const data = await fs.readFile(cached);
		return json(JSON.parse(data.toString()));
	} catch (e) {
		// ignore
	}

	const studentPage = await getStudentsPage(code);

	const info: Course = {
		code,
		median: await getMedian(code),
		points: getPoints(studentPage),
		name: getName(studentPage),
		connections: getConnections(studentPage)
	};

	// create the cache directory if it doesn't exist
	try {
		await fs.mkdir(cacheDir, { recursive: true });
	} catch (e) {
		// ignore
	}

	// cache the course data
	await fs.writeFile(path.join(cacheDir, `${code}.json`), JSON.stringify(info));

	return json(info);
};
