import catalogs from '$lib/assets/catalogs.json';

export function parseCatalog(text: string): string[] {
	const regex = /\b\d{5,6}\b/g;
	const matches = text.match(regex);

	const codes = [...new Set(matches ? matches : [])];
	return codes
		.map((code) => code.replace(/^0+/, ''))
		.map((code) => '0'.repeat(6 - code.length) + code)
		.map((code) => '0' + code.slice(0, 3) + '0' + code.slice(3));
}

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
		courses = parseCatalog(await response.text()).sort();
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
	degree: Degree,
	_fetch: (
		input: string | URL | globalThis.Request,
		init?: RequestInit
	) => Promise<Response> = fetch
): Promise<Catalog> {
	const [year, faculty, path] = degree;

	// TODO why does this not work?
	// @ts-expect-error
	const catalog = catalogs[year][faculty][path];

	const requirement = await loadCourses(catalog.requirement, _fetch);
	const sharedRequirement = await loadCourses(catalogs[year].shared, _fetch);

	requirement.nested?.push(sharedRequirement);

	return {
		degree,
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
