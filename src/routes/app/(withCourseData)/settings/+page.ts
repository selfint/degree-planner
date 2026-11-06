import type { PageLoad } from './$types';
import { loadPublicJson } from '$lib/publicData';

export const load: PageLoad = ({ fetch }) => {
	const catalogs = loadPublicJson<Catalogs>('/catalogs.json', fetch);

	return {
		catalogs
	};
};
