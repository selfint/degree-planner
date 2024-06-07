import { parseCatalog } from './server/catalogParser';

async function get(degree: Degree, ...path: string[]): Promise<string> {
	const response = await fetch(
		`/_db/${degree.join('/')}/requirements/${path.join('/')}`
	);

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

	// @ts-expect-error
	const choice: Choice = {
		amount,
		...Object.fromEntries(options)
	};

	return choice;
}

async function loadRequirementHeader(
	degree: Degree,
	header: RequirementHeader,
	...path: string[]
): Promise<Requirement> {
	console.log('Loading ', path.join('/'), ' for header ', header);
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

export async function loadRequirementsHeader(
	degree: Degree,
	header: RequirementsHeader
): Promise<DegreeRequirements> {
	const requirements = new Map<string, Requirement>();

	const conditions = Object.entries(header).filter(
		([name]) => !['points'].includes(name)
	);

	const points = parseFloat(await get(degree, 'points'));

	for (const [name, requirement] of conditions) {
		requirements.set(
			name,
			await loadRequirementHeader(degree, requirement, name)
		);
	}

	// @ts-expect-error
	const degreeRequirements: DegreeRequirements = {
		points,
		...Object.fromEntries(requirements)
	};

	return degreeRequirements;
}
