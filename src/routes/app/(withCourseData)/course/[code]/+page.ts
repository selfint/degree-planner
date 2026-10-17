import type { PageLoad } from './$types';
import { loadPublicJson } from '$lib/publicData';

export const load: PageLoad = ({ params, fetch }) => {
	const { code } = params;

	const url = `/_courses/${code}`;
	const fallback = {
		// Keep the existing placeholder for old/shared course IDs absent from current data.
		code: code as CourseCode
	};
	const course: Promise<FullCourse> = loadPublicJson<FullCourse>(
		url,
		fetch
	).catch(() => fallback);

	return {
		course
	};
};
