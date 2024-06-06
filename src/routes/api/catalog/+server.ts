import { json } from '@sveltejs/kit';

import manifest from '$lib/assets/manifest.json';

export const GET = async () => {
	return json(Object.keys(manifest));
};
