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

	const degree = [year, faculty, path] as Degree;

	return {
		degree,
		semesters,
		userPath
	};
};
