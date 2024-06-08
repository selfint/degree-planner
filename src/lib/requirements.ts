import manifest from '$lib/assets/manifest.json';

import { parseCatalog } from './catalogParser';

async function get(degree: Degree, ...path: string[]): Promise<string> {
	const response = await fetch(`/_db/${degree.join('/')}/${path.join('/')}`);

	if (!response.ok) {
		throw new Error(response.statusText);
	}

	return response.text();
}

async function loadChoiceHeader(
	degree: Degree,
	choiceHeader: ChoiceHeader,
	...path: string[]
): Promise<Choice> {
	const options = new Map<string, Requirement>();

	const amount = parseInt(await get(degree, ...path, 'choice', 'amount'));
	const optionHeaders = Object.entries<RequirementHeader>(choiceHeader).filter(
		([option]) => option !== 'amount'
	);
	for (const [option, requirement] of optionHeaders) {
		options.set(
			option,
			await loadRequirementHeader(
				degree,
				requirement,
				...path,
				'choice',
				option
			)
		);
	}

	return {
		amount,
		options
	};
}

async function loadRequirementHeader(
	degree: Degree,
	header: RequirementHeader,
	...path: string[]
): Promise<Requirement> {
	let requirements = {
		courses:
			header.courses === null
				? parseCatalog(await get(degree, ...path, 'courses'))
				: undefined,
		points:
			header.points === null
				? parseFloat(await get(degree, ...path, 'points'))
				: undefined,
		count:
			header.count === null
				? parseInt(await get(degree, ...path, 'count'))
				: undefined,
		overflow:
			header.overflow === null
				? await get(degree, ...path, 'overflow')
				: undefined,
		...(header.choice === undefined
			? {}
			: { choice: await loadChoiceHeader(degree, header.choice, ...path) })
	};

	// @ts-expect-error
	requirements = Object.fromEntries(
		Object.entries(requirements).filter(([_, value]) => value !== undefined)
	);

	return requirements;
}

export async function loadDegreeRequirements(
	degree: Degree,
	header: RequirementsHeader
): Promise<DegreeRequirements> {
	const requirements = new Map<string, Requirement>();

	const conditions = Object.entries(header).filter(
		([name]) => !['points'].includes(name)
	);

	const points = parseFloat(await get(degree, 'requirements', 'points'));

	for (const [name, requirement] of conditions) {
		requirements.set(
			name,
			await loadRequirementHeader(degree, requirement, 'requirements', name)
		);
	}

	// @ts-expect-error
	const degreeRequirements: DegreeRequirements = {
		points,
		...Object.fromEntries(requirements)
	};

	return degreeRequirements;
}

export async function loadDegreeRecommendation(
	degree: Degree,
	header: Record<string, null>
): Promise<string[][]> {
	let recommendation = [];
	for (const semester of Object.keys(header).sort()) {
		recommendation.push(
			parseCatalog(await get(degree, 'recommended', semester))
		);
	}

	return recommendation;
}

export async function loadDegreeData(degree: Degree): Promise<DegreeData> {
	// @ts-expect-error
	const header = manifest[degree[0]][degree[1]][degree[2]];

	const recommended = await loadDegreeRecommendation(
		degree,
		header.recommended
	);
	const requirements = await loadDegreeRequirements(
		degree,
		header.requirements
	);

	return { recommended, requirements };
}
