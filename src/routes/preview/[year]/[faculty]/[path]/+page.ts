import catalogs from '$lib/assets/catalogs.json';
import { loadCatalog } from '$lib/requirements';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const { year, faculty, path } = params;

	// @ts-expect-error
	if (!catalogs[year]) {
		throw new Error(`Year not found: ${year}`);
	}

	// @ts-expect-error
	if (!catalogs[year][faculty]) {
		throw new Error(`Faculty not found: ${year}/${faculty}`);
	}

	// @ts-expect-error
	if (!catalogs[year][faculty][path]) {
		throw new Error(`Degree not found: ${year}/${faculty}/${path}`);
	}

	const degree = [year, faculty, path] as Degree;
	const degreeData = await loadCatalog(degree, fetch);

	return {
		degreeData
	};
};
