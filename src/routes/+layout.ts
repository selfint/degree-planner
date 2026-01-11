import type { LayoutLoad } from './$types';

import { initFirebase } from '$lib/firebase.svelte';

export const load: LayoutLoad = async ({ fetch }) => {
	const courseData: Promise<Record<string, Course>> = fetch(
		'/courseData.json'
	).then((r) => r.json());

	return {
		firebase: await initFirebase(),
		getCourseData: async (code: string) => (await courseData)[code] || { code },
		courseData
	};
};
