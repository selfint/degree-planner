import fs from 'fs/promises';
import path from 'path';

import { json } from '@sveltejs/kit';
import {
	getAbout,
	getConnections,
	getName,
	getPoints,
	getCourseInfo,
	getTests,
	getSeasons
} from '$lib/server/courseSAPInfo.js';
import { getMedian } from '$lib/server/courseMedian.js';

const cacheDir = path.resolve('static', '_cache', 'courseData');

export const GET = async ({ params: { code } }) => {
	const courseInfo = await getCourseInfo(code);

	if (courseInfo === undefined) {
		return json({
			code
		});
	}

	const course: Course = {
		code,
		median: await getMedian(code),
		points: getPoints(courseInfo),
		name: getName(courseInfo),
		connections: getConnections(courseInfo),
		about: getAbout(courseInfo),
		tests: getTests(courseInfo),
		seasons: getSeasons(courseInfo)
	};

	// update cache only in dev mode
	if (import.meta.env.MODE === 'development') {
		try {
			await fs.mkdir(cacheDir, { recursive: true });
		} catch (e) {
			// ignore
		}

		// cache the course data
		await fs.writeFile(
			path.join(cacheDir, `${code}.json`),
			JSON.stringify(course)
		);
	}

	return json(course);
};
