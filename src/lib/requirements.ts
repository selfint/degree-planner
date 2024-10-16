import manifest from '$lib/assets/manifest.json';

import { parseCatalog } from './catalogParser';

function sortObject(obj: any): any {
	if (Array.isArray(obj)) {
		return obj.map(sortObject).sort((a, b) => {
			if (typeof a === 'object' && typeof b === 'object') {
				return JSON.stringify(a).localeCompare(JSON.stringify(b));
			}
			return a > b ? 1 : a < b ? -1 : 0;
		});
	} else if (obj !== null && typeof obj === 'object') {
		if (obj instanceof Map) {
			// Sort the Map entries by key
			const sortedMap = new Map(
				[...obj.entries()]
					.sort((a, b) => {
						if (typeof a[0] === 'object' && typeof b[0] === 'object') {
							return JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0]));
						}
						return a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0;
					})
					.map(([key, value]) => [sortObject(key), sortObject(value)])
			);
			return sortedMap;
		} else {
			const sortedObj: { [key: string]: any } = {};
			Object.keys(obj)
				.sort()
				.forEach((key) => {
					sortedObj[key] = sortObject(obj[key]);
				});
			return sortedObj;
		}
	}
	return obj;
}

async function _get(degree: Degree, ...path: string[]): Promise<string> {
	const response = await fetch(`/_db/${degree.join('/')}/${path.join('/')}`);

	if (!response.ok) {
		throw new Error(response.statusText);
	}

	return response.text();
}

async function loadChoiceHeader(
	get: (degree: Degree, ...path: string[]) => Promise<string>,
	degree: Degree,
	choiceHeader: ChoiceHeader,
	...path: string[]
): Promise<Choice> {
	const amount = get(degree, ...path, 'choice', 'amount').then(parseInt);
	const optionHeaders = Object.entries<RequirementHeader>(choiceHeader).filter(
		([option]) => option !== 'amount'
	);

	const options = new Map<string, Requirement>();
	await Promise.all(
		optionHeaders.map(async ([option, requirement]) => {
			options.set(
				option,
				await loadRequirementHeader(
					get,
					degree,
					requirement,
					...path,
					'choice',
					option
				)
			);
		})
	);

	return {
		amount: await amount,
		options
	};
}

async function loadRequirementHeader(
	get: (degree: Degree, ...path: string[]) => Promise<string>,
	degree: Degree,
	header: RequirementHeader,
	...path: string[]
): Promise<Requirement> {
	const coursesF =
		header.courses === null
			? get(degree, ...path, 'courses').then(parseCatalog)
			: undefined;
	const pointsF =
		header.points === null
			? get(degree, ...path, 'points').then(parseFloat)
			: undefined;
	const countF =
		header.count === null
			? get(degree, ...path, 'count').then(parseInt)
			: undefined;
	const overflowF =
		header.overflow === null ? get(degree, ...path, 'overflow') : undefined;
	const choiceF =
		header.choice === undefined
			? undefined
			: loadChoiceHeader(get, degree, header.choice, ...path);

	let requirements = {
		courses: await coursesF,
		points: await pointsF,
		count: await countF,
		overflow: await overflowF,
		choice: await choiceF
	};

	// remove undefined values
	// @ts-expect-error
	requirements = Object.fromEntries(
		Object.entries(requirements).filter(([, value]) => value !== undefined)
	);

	return requirements;
}

async function loadDegreeRequirements(
	degree: Degree,
	header: RequirementsHeader,
	get: (degree: Degree, ...path: string[]) => Promise<string>
): Promise<DegreeRequirements> {
	const points = get(degree, 'requirements', 'points').then(parseFloat);

	const conditions = Object.entries(header).filter(
		([name]) => !['points'].includes(name)
	);
	const requirements = new Map<string, Requirement>(
		(await Promise.all(
			conditions.map(async ([name, requirement]) => [
				name,
				await loadRequirementHeader(
					get,
					degree,
					requirement,
					'requirements',
					name
				)
			])
		)) as [string, Requirement][]
	);

	return {
		points: await points,
		requirements
	};
}

async function loadDegreeRecommendation(
	degree: Degree,
	header: Record<string, null>,
	get: (degree: Degree, ...path: string[]) => Promise<string>
): Promise<string[][]> {
	return await Promise.all(
		Object.keys(header).map(async (semester) =>
			parseCatalog(await get(degree, 'recommended', semester))
		)
	);
}

export async function loadDegreeData(
	degree: Degree,
	get: (degree: Degree, ...path: string[]) => Promise<string> = _get
): Promise<DegreeData> {
	// @ts-expect-error
	const header = manifest[degree[0]][degree[1]][degree[2]];

	const recommendedF = loadDegreeRecommendation(
		degree,
		header.recommended,
		get
	);
	const requirementsF = loadDegreeRequirements(
		degree,
		header.requirements,
		get
	);

	const data = {
		recommended: await recommendedF,
		requirements: await requirementsF.then(sortObject)
	};

	return data;
}

function courseInRequirement(requirement: Requirement, code: string): boolean {
	if (requirement.courses?.includes(code)) {
		return true;
	}

	if (requirement.choice) {
		for (const option of requirement.choice.options.values()) {
			if (courseInRequirement(option, code)) {
				return true;
			}
		}
	}

	return false;
}

export function getCourseLists(
	requirements: DegreeRequirements | undefined,
	code: string
): string[] {
	if (requirements === undefined) {
		return [];
	}

	let lists = [];
	for (const [name, requirement] of requirements.requirements) {
		if (courseInRequirement(requirement, code)) {
			lists.push(name);
		}

		if (requirement.choice) {
			for (const option of requirement.choice.options.values()) {
				if (courseInRequirement(option, code)) {
					lists.push(name);
				}
			}
		}
	}

	return [...new Set(lists)].toSorted();
}

function getRequirementCourses(
	requirement: Requirement,
	path: string[] = []
): { path: string[]; courses: string[] }[] {
	const result = [];

	if (requirement.courses) {
		result.push({ path, courses: requirement.courses });
	}

	if (requirement.choice) {
		for (const [option, choice] of requirement.choice.options) {
			result.push(...getRequirementCourses(choice, [...path, option]));
		}
	}

	return result;
}

export function getDegreeRequirementCourses(
	requirements: DegreeRequirements
): { path: string[]; courses: string[] }[] {
	const result = [];

	for (const [name, requirement] of requirements.requirements) {
		result.push(...getRequirementCourses(requirement, [name]));
	}

	return result;
}
