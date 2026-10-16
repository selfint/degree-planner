const identifier = /^[A-Za-z0-9_-]+$/;
const courseCode = /^\d{8}$/;
const requirementUrl =
	/^\/_catalogs\/\d{4}_\d{3}\/\d{8}\/[A-Za-z0-9_-]+\/requirementsData\.json$/;

function object(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bilingual(value: unknown): value is Record<string, unknown> {
	return (
		object(value) &&
		typeof value.en === 'string' &&
		typeof value.he === 'string'
	);
}

function optionalFields(
	value: Record<string, unknown>,
	strings: string[],
	numbers: string[]
): boolean {
	return (
		strings.every(
			(key) => value[key] === undefined || typeof value[key] === 'string'
		) &&
		numbers.every(
			(key) =>
				value[key] === undefined ||
				(typeof value[key] === 'number' && Number.isFinite(value[key]))
		)
	);
}

function codes(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.every((code) => typeof code === 'string' && courseCode.test(code))
	);
}

function course(value: unknown, code: string): boolean {
	if (
		!object(value) ||
		value.code !== code ||
		!optionalFields(value, ['name', 'about', 'faculty'], ['points'])
	)
		return false;
	// Existing snapshots use null for a missing histogram median.
	if (
		value.median !== undefined &&
		value.median !== null &&
		(typeof value.median !== 'number' || !Number.isFinite(value.median))
	)
		return false;
	if (value.current !== undefined && typeof value.current !== 'boolean')
		return false;
	if (
		value.seasons !== undefined &&
		(!Array.isArray(value.seasons) ||
			!value.seasons.every((season) => typeof season === 'string'))
	)
		return false;
	if (value.connections !== undefined) {
		const connections = value.connections;
		if (
			!object(connections) ||
			!Array.isArray(connections.dependencies) ||
			!connections.dependencies.every(codes) ||
			!codes(connections.adjacent) ||
			!codes(connections.exclusive)
		)
			return false;
	}
	if (value.tests !== undefined) {
		const date = (test: unknown) =>
			object(test) &&
			['year', 'monthIndex', 'day'].every(
				(key) => typeof test[key] === 'number' && Number.isFinite(test[key])
			);
		if (
			!Array.isArray(value.tests) ||
			value.tests.length !== 2 ||
			!date(value.tests[0]) ||
			(value.tests[1] !== null && !date(value.tests[1]))
		)
			return false;
	}
	return true;
}

/** Only public, language-independent static resources may enter this cache. */
export function isPublicDataUrl(url: string): boolean {
	return (
		['/catalogs.json', '/courseData.json', '/courseDataStripped.json'].includes(
			url
		) ||
		/^\/_courses\/\d{8}$/.test(url) ||
		requirementUrl.test(url)
	);
}

function manifest(value: unknown): boolean {
	if (!object(value) || Object.keys(value).length === 0) return false;
	let programs = 0;
	for (const [catalogId, catalog] of Object.entries(value)) {
		if (!/^\d{4}_\d{3}$/.test(catalogId) || !bilingual(catalog)) return false;
		for (const [facultyId, faculty] of Object.entries(catalog)) {
			if (facultyId === 'en' || facultyId === 'he') continue;
			if (!/^\d{8}$/.test(facultyId) || !bilingual(faculty)) return false;
			for (const [programId, program] of Object.entries(faculty)) {
				if (programId === 'en' || programId === 'he') continue;
				if (!identifier.test(programId) || !bilingual(program)) return false;
				programs++;
			}
		}
	}
	return programs > 0;
}

function requirement(
	value: unknown,
	seen = new Set<unknown>(),
	depth = 0
): boolean {
	if (
		!bilingual(value) ||
		typeof value.name !== 'string' ||
		!identifier.test(value.name) ||
		depth > 100 ||
		seen.has(value)
	)
		return false;
	seen.add(value);
	if (
		!optionalFields(value, ['overflow', 'hook'], ['points', 'count', 'amount'])
	)
		return false;
	if (value.courses !== undefined && !codes(value.courses)) return false;
	return (
		value.nested === undefined ||
		(Array.isArray(value.nested) &&
			value.nested.every((node) => requirement(node, seen, depth + 1)))
	);
}

/** Validate the stable wire fields, retaining all optional and custom metadata. */
export function isPublicData(url: string, value: unknown): boolean {
	if (!isPublicDataUrl(url)) return false;
	if (url === '/catalogs.json') return manifest(value);
	if (requirementUrl.test(url)) return requirement(value);
	if (!object(value)) return false;
	if (url.startsWith('/_courses/'))
		return course(value, url.slice('/_courses/'.length));
	const courses = Object.entries(value);
	return (
		courses.length > 0 &&
		courses.every(
			([code, value]) => courseCode.test(code) && course(value, code)
		)
	);
}
