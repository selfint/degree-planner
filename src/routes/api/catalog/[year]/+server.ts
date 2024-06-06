import { json, error } from '@sveltejs/kit';

import manifest from '$lib/assets/manifest.json';

export const GET = async ({ params: { year } }) => {
	if (!(year in manifest)) {
		return json([]);
	}

	return json(Object.keys(manifest[year]));
};
