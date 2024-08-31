import type { HandleServerError } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

const cacheDir = path.resolve('static', '_cache', 'courseData');

export const handleError: HandleServerError = async ({
	error,
	event,
	status,
	message
}) => {
	console.error(error);

	// in dev mode, if course data is not found, create a cache file with the course code
	// to mark it as not found
	if (
		import.meta.env.MODE === 'development' &&
		status === 404 &&
		event.request.url.includes('/_cache/courseData/')
	) {
		try {
			await fs.mkdir(cacheDir, { recursive: true });
		} catch (e) {
			// ignore
		}

		const courseFilename = event.request.url.split('/').pop();

		if (courseFilename === undefined) {
			return;
		}

		const code = courseFilename.replace('.json', '');
		await fs.writeFile(
			path.join(cacheDir, courseFilename),
			JSON.stringify({ code })
		);
	}
};
