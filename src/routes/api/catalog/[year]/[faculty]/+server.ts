import { json } from '@sveltejs/kit';

import manifest from '$lib/assets/manifest.json';

export const GET = async ({ params: { year, faculty } }) => {
	if (!(year in manifest) || !(faculty in manifest[year])) {
		return json([]);
	}

	return json(Object.keys(manifest[year][faculty]));
};
