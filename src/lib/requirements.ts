import { loadPublicJson } from './publicData';
import { isDegreeSelection } from './catalogSelection';

export class UnavailableCurriculumError extends Error {
	constructor(degree: Degree) {
		super(`Curriculum unavailable for ${degree.join('/')}`);
		this.name = 'UnavailableCurriculumError';
	}
}

function requireAvailableDegree(catalogs: Catalogs, degree: Degree) {
	if (!isDegreeSelection(catalogs, degree))
		throw new UnavailableCurriculumError(degree);
}

export async function loadRequirement(
	degree: Degree,
	path?: string,
	_fetch: typeof fetch = fetch
): Promise<Requirement> {
	const catalogs = await loadPublicJson<Catalogs>('/catalogs.json', _fetch);
	requireAvailableDegree(catalogs, degree);
	return fetchRequirement(degree, path, _fetch);
}

async function fetchRequirement(
	userDegree: Degree,
	path: string | undefined = undefined,
	_fetch: (
		input: string | URL | globalThis.Request,
		init?: RequestInit
	) => Promise<Response> = fetch
): Promise<Requirement> {
	const requirement = await loadPublicJson<Requirement>(
		['/_catalogs', ...userDegree, 'requirementsData.json'].join('/'),
		_fetch
	);

	if (path !== undefined) {
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

	const _catalogs = await catalogs;
	requireAvailableDegree(_catalogs, userDegree);
	const requirement = await fetchRequirement(userDegree, path, _fetch);
	const yearCatalog: I18N = _catalogs[year];
	// Each faculty contains only a subset of the catalog's program codes. Model
	// that membership explicitly instead of losing the Degree tuple correlation.
	const facultyCatalog: I18N & Partial<Record<Degree[2], I18N>> =
		_catalogs[year][faculty];
	const catalog = facultyCatalog[degree];
	if (catalog === undefined)
		throw new Error(`Unknown degree program ${degree}`);

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

		const [year, faculty, degree, path] = levels;
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

export async function loadDegreeName(
	lang: 'en' | 'he',
	catalogName: string,
	degree: Degree,
	path?: string,
	_fetch: typeof fetch = fetch
): Promise<string> {
	const [year, faculty, program] = degree;
	const catalogs = await loadPublicJson<Catalogs>('/catalogs.json', _fetch);
	requireAvailableDegree(catalogs, degree);
	const requirement =
		path === undefined
			? undefined
			: await fetchRequirement(degree, undefined, _fetch);
	const yearName = catalogs[year][lang];
	const facultyName = catalogs[year][faculty][lang];
	const facultyCatalog: I18N & Partial<Record<Degree[2], I18N>> =
		catalogs[year][faculty];
	const degreeName = facultyCatalog[program]![lang];
	const title = `${facultyName} (${catalogName} ${yearName}) - ${degreeName}`;
	if (path === undefined) return title;
	const selectedPath = requirement?.nested?.find((node) => node.name === path);
	if (selectedPath === undefined)
		throw new Error(`Unknown degree path ${path}`);
	return `${title} ${selectedPath[lang]}`;
}
