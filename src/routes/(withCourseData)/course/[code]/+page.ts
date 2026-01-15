import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, fetch }) => {
	const { code } = params;

	const url = `/_courses/${code}`;
	const fallback = {
		code
	};
	const course: Promise<FullCourse> = fetch(url)
		.then((r) => r.json().catch(() => fallback))
		.catch(() => fallback);

	return {
		course
	};
};
