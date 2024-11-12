import catalogs from '$lib/assets/catalogs.json';

async function loadCourses(
	requirementHeader: RequirementHeader,
	_fetch: (
		input: string | URL | globalThis.Request,
		init?: RequestInit
	) => Promise<Response>
): Promise<Requirement> {
	let courses = undefined;
	if (requirementHeader.courses !== undefined) {
		const response = await _fetch(requirementHeader.courses);
		courses = await response.text().then((t) => t.split('\n').sort());
	}

	let nested = undefined;
	if (requirementHeader.nested !== undefined) {
		nested = await Promise.all(
			requirementHeader.nested.map((header) => loadCourses(header, _fetch))
		);
	}

	let hook: Requirement['hook'] = undefined;
	if (requirementHeader.hook !== undefined) {
		const response = await _fetch(requirementHeader.hook);
		const src = await response.text();

		hook = new Function('semesters', 'progress', src) as Requirement['hook'];
	}

	return {
		...requirementHeader,
		...(courses !== undefined && { courses }),
		...(nested !== undefined && { nested }),
		...(hook !== undefined && { hook: hook })
	} as Requirement;
}

export async function loadCatalog(
	userDegree: Degree,
	path: string | undefined = undefined,
	_fetch: (
		input: string | URL | globalThis.Request,
		init?: RequestInit
	) => Promise<Response> = fetch
): Promise<Catalog> {
	const [year, faculty, degree] = userDegree;

	// TODO why does this not work?
	// @ts-expect-error
	const catalog = catalogs[year][faculty][degree];

	const requirement = await loadCourses(catalog.requirement, _fetch);

	if (path !== undefined) {
		requirement.nested = requirement.nested?.filter(
			(nested) =>
				nested.name === path || nested.en.toLowerCase().includes('elective')
		);
	}

	return {
		degree: userDegree,
		recommended: catalog.recommended,
		requirement
	};
}

export function getCourseLists(
	requirement: Requirement | undefined,
	code: string
): Requirement[][] {
	if (requirement === undefined) {
		return [];
	}

	function _getLists(r: Requirement, path: Requirement[]): Requirement[][] {
		const lists: Requirement[][] = [];
		path = [...path, r];

		for (const nested of r.nested ?? []) {
			lists.push(..._getLists(nested, path));
		}

		if (lists.length > 0) {
			return lists;
		}

		if (r.courses?.includes(code)) {
			lists.push(path);
		}

		return lists;
	}

	// const lists = [..._getLists(requirement, [])];
	const lists = requirement.nested?.flatMap((r) => _getLists(r, [])) ?? [];

	return lists;
}

export function getDegreeRequirementCourses(
	requirement: Requirement
): { path: Requirement[]; courses: string[] }[] {
	function _getRequirementCourses(
		r: Requirement,
		path: Requirement[]
	): { path: Requirement[]; courses: string[] }[] {
		// add the current requirement to the path
		path = [...path, r];

		const result = [];
		if (r.courses) {
			result.push({ path, courses: r.courses });
		}

		for (const nested of r.nested ?? []) {
			result.push(..._getRequirementCourses(nested, path));
		}

		return result;
	}

	const value =
		requirement.nested?.flatMap((r) => _getRequirementCourses(r, [])) ?? [];

	return value;
}
