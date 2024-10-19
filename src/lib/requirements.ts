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

	return {
		...requirementHeader,
		...(courses && { courses }),
		...(nested && { nested })
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
): Requirement[] {
	if (requirement === undefined) {
		return [];
	}

	const lists: Requirement[] = [];
	function _getLists(r: Requirement): void {
		if (r.courses?.includes(code)) {
			lists.push(r);
		}

		for (const nested of r.nested ?? []) {
			_getLists(nested);
		}
	}

	// _getLists(requirement);
	requirement.nested?.forEach((r) => _getLists(r));

	return lists;
}

export function getDegreeRequirementCourses(
	requirement: Requirement
): { path: string[]; courses: string[] }[] {
	function _getRequirementCourses(
		r: Requirement,
		path: string[]
	): { path: string[]; courses: string[] }[] {
		// add the current requirement to the path
		path = [...path, r.name];

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
