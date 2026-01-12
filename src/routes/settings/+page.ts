import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, parent }) => {
	return {
		...parent,
		catalogs: fetch('/catalogsHeader.json').then(
			async (c) => (await c.json()) as Catalogs
		)
	};
};
