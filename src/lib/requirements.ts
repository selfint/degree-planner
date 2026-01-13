export async function loadRequirement(
	userDegree: Degree,
	path: string | undefined = undefined,
	_fetch: (
		input: string | URL | globalThis.Request,
		init?: RequestInit
	) => Promise<Response> = fetch
): Promise<Requirement> {
	const requirement: Requirement = await _fetch(
		['/_catalogs', ...userDegree, 'requirementsData.json'].join('/')
	).then((r) => r.json());

	let pathCatalog: Requirement | undefined = undefined;
	if (path !== undefined) {
		pathCatalog = requirement.nested?.find((nested) => nested.name === path);

		requirement.nested = requirement.nested?.filter(
			(nested) =>
				nested.name === path || nested.en.toLowerCase().includes('elective')
		);
	}

	return requirement;
}

export async function loadCatalog(
	catalogs: Promise<Catalogs>,
	userDegree: Degree,
	path: string | undefined = undefined,
	_fetch: (
		input: string | URL | globalThis.Request,
		init?: RequestInit
	) => Promise<Response> = fetch
): Promise<Catalog> {
	const [year, faculty, degree] = userDegree;

	const [_catalogs, requirement] = await Promise.all([
		catalogs,
		loadRequirement(userDegree, path, _fetch)
	]);
	const yearCatalog: I18N = _catalogs[year];
	const facultyCatalog: I18N = _catalogs[year][faculty];

	// TODO why does this not work?
	// @ts-expect-error
	const catalog: I18N = _catalogs[year][faculty][degree];

	const catalogLevels = [yearCatalog, facultyCatalog, catalog];

	if (path !== undefined) {
		catalogLevels.push({ en: requirement.en, he: requirement.he });
	}

	function applyI18n(i18n: I18N, lang: 'en' | 'he'): string {
		let name = i18n.en;
		if (lang === 'he') {
			name = i18n.he;
		}

		return name;
	}

	function buildCatalogName(levels: I18N[], lang: 'en' | 'he'): string {
		const catalogName = lang === 'en' ? 'catalog' : 'קטלוג';

		let [year, faculty, degree, path] = levels;
		const yearName = applyI18n(year, lang);
		const facultyName = applyI18n(faculty, lang);
		const degreeName = applyI18n(degree, lang);
		if (path === undefined) {
			return `${facultyName} (${catalogName} ${yearName}) - ${degreeName}`;
		} else {
			const pathName = applyI18n(path, lang);
			return `${facultyName} (${catalogName} ${yearName}) - ${degreeName} ${pathName}`;
		}
	}

	const i18n = {
		en: buildCatalogName(catalogLevels, 'en'),
		he: buildCatalogName(catalogLevels, 'he')
	};

	return {
		degree: userDegree,
		path,
		i18n,
		recommended: undefined,
		requirement
	};
}

export function getCourseLists(
	requirement: Requirement | undefined,
	code: CourseCode
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

	return requirement.nested?.flatMap((r) => _getLists(r, [])) ?? [];
}

export function getDegreeRequirementCourses(
	requirement: Requirement
): { path: Requirement[]; courses: CourseCode[] }[] {
	function _getRequirementCourses(
		r: Requirement,
		path: Requirement[]
	): { path: Requirement[]; courses: CourseCode[] }[] {
		// add the current requirement to the path
		path = [...path, r];

		const result = [];
		if (r.courses !== undefined) {
			result.push({ path, courses: r.courses });
		}

		for (const nested of r.nested ?? []) {
			result.push(..._getRequirementCourses(nested, path));
		}

		return result;
	}

	return (
		requirement.nested?.flatMap((r) => _getRequirementCourses(r, [])) ?? []
	);
}
