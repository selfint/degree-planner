import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => {
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
