import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = async ({
	error,
	event,
	status
}) => {
	// ignore 404 errors for course data
	const ignoredRoutes = ['/_cache/courseData/', 'technion-histograms'];
	if (
		status === 404 &&
		ignoredRoutes.some((route) => event.request.url.includes(route))
	) {
		return;
	}

	console.error(error);
};
