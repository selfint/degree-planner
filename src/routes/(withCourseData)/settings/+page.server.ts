import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ fetch }) => {
	const catalogs: Promise<Catalogs> = fetch('/catalogs.json').then((c) =>
		c.json()
	);

	return {
		catalogs
	};
};
