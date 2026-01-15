import type { PageLoad } from './$types';

export const load: PageLoad = ({ fetch }) => {
	const catalogs: Promise<Catalogs> = fetch('/catalogs.json').then((c) =>
		c.json()
	);

	return {
		catalogs
	};
};
