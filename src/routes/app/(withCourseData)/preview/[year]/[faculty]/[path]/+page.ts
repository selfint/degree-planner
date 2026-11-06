import type { PageLoad } from './$types';
import { compatiblePlan } from '$lib/planCompatibility';

export const load: PageLoad = ({ params, url }) => {
	const { year, faculty, path } = params;

	const semesters =
		url.searchParams
			.get('semesters')
			?.trim()
			.split('~')
			.map((s) => s.split('-').filter((c) => c !== '')) ?? [];

	const userPath = url.searchParams.get('path') ?? undefined;

	// Old shared links can contain the same historical migration mismatch as
	// saved plans. Normalize before displaying the title or copying the plan,
	// without rewriting the original URL or changing its semester data.
	const selection = compatiblePlan({
		degree: [year, faculty, path] as Degree,
		path: userPath
	});

	return {
		degree: selection.degree,
		semesters,
		userPath: selection.path
	};
};
