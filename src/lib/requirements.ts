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

	const result: Requirement = {
		...requirementHeader,
		...(courses !== undefined && { courses }),
		...(nested !== undefined && { nested }),
		...(hook !== undefined && { hook: hook })
	} as Requirement;

	return result;
}

export async function loadCatalog(
	userDegree: Degree,
	path: string | undefined = undefined,
	_fetch: (
		input: string | URL | globalThis.Request,
		init?: RequestInit
	) => Promise<Response> = fetch
): Promise<Catalog> {
	const response = await _fetch('/catalogs.json');
	const catalogs: Catalogs = await response.json();

	const [year, faculty, degree] = userDegree;

	const yearCatalog: I18N = catalogs[year];
	const facultyCatalog: I18N = catalogs[year][faculty];

	// TODO why does this not work?
	// @ts-expect-error
	const catalog = catalogs[year][faculty][degree];

	const requirement = await loadCourses(catalog.requirement, _fetch);

	let pathCatalog: Requirement | undefined = undefined;
	if (path !== undefined) {
		pathCatalog = requirement.nested?.find((nested) => nested.name === path);

		requirement.nested = requirement.nested?.filter(
			(nested) =>
				nested.name === path || nested.en.toLowerCase().includes('elective')
		);
	}

	const catalogLevels = [yearCatalog, facultyCatalog, catalog as I18N];

	if (pathCatalog !== undefined) {
		catalogLevels.push(pathCatalog satisfies I18N);
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
