import { json } from '@sveltejs/kit';

import manifest from '$lib/assets/manifest.json';

export const GET = async ({ params: { year, faculty, path } }) => {
	if (!(year in manifest) || !(faculty in manifest[year]) || !(path in manifest[year][faculty])) {
		return json([]);
	}

	return json(manifest[year][faculty][path]);
};
