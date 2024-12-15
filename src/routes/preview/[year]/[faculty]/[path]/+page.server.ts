import catalogs from '$lib/assets/catalogs.json';
import { loadCatalog } from '$lib/requirements';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, fetch }) => {
	const { year, faculty, path } = params;

	const semesters =
		url.searchParams
			.get('semesters')
			?.trim()
			.split('~')
			.map((s) => s.split('-').filter((c) => c !== '')) ?? [];

	const userPath = url.searchParams.get('path') ?? undefined;

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
	const degreeData = await loadCatalog(degree, userPath, fetch);
	console.log('here3', degree, userPath, degreeData, semesters);

	return {
		degreeData,
		semesters,
		userPath
	};
};
