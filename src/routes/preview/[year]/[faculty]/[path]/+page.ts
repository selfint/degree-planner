import { loadDegreeData } from '$lib/requirements';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const { year, faculty, path } = params;

	async function get(degree: Degree, ...path: string[]): Promise<string> {
		const response = await fetch(`/_db/${degree.join('/')}/${path.join('/')}`);

		if (!response.ok) {
			throw new Error(response.statusText);
		}

		return response.text();
	}
	const degreeData = await loadDegreeData([year, faculty, path], get);

	return {
		degreeData
	};
};
