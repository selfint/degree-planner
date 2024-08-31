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
	// ignore 404 errors for course data cache
	if (status === 404 && event.request.url.includes('/_cache/courseData/')) {
		return;
	}

	console.error(error);
};
