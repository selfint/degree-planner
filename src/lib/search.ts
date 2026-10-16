export const searchFilterKeys = [
	'available',
	'faculty',
	'pointsMin',
	'pointsMax',
	'medianMin'
] as const;

export type SearchFilters = {
	available: boolean;
	faculty: string;
	pointsMin: number;
	pointsMax: number;
	medianMin: number;
};

function finiteNumber(value: string | null): number | undefined {
	if (value === null || value.trim() === '') return undefined;
	const number = Number(value);
	return Number.isFinite(number) ? number : undefined;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function roundedFilterNumber(value: number, min: number, max: number): number {
	return clamp(Math.round(clamp(value, min, max) * 10) / 10, min, max);
}

/** Snap a slider gesture to a half-point grid without quantizing typed tenths. */
export function snapPointSliderValue(
	value: number,
	min: number,
	max: number
): number {
	const lower = Math.ceil(min * 2) / 2;
	const upper = Math.floor(max * 2) / 2;
	if (lower > upper) return clamp(value, min, max);
	return clamp(Math.round(value * 2) / 2, lower, upper);
}

export function stepPointSliderValue(
	value: number,
	direction: 1 | -1,
	min: number,
	max: number
): number {
	const next =
		direction === 1
			? (Math.floor(value * 2) + 1) / 2
			: (Math.ceil(value * 2) - 1) / 2;
	const snapped = snapPointSliderValue(next, min, max);
	// A manually typed endpoint must not jump backwards when its next grid point is out of range.
	if (direction === 1 ? snapped < value : snapped > value)
		return clamp(value, min, max);
	return snapped;
}

/** Normalize a committed number field, keeping unfinished typing local to the input. */
export function resolveNumericFilterInput(
	value: string,
	min: number,
	max: number,
	emptyValue: number,
	previousValue: number,
	badInput = false
): number {
	if (badInput) return previousValue;
	if (value.trim() === '') return clamp(emptyValue, min, max);
	const number = Number(value);
	return Number.isFinite(number)
		? roundedFilterNumber(number, min, max)
		: previousValue;
}

export function normalizeSearchQuery(query: string): string {
	const trimmed = query.trim();
	// Keep links using the old six-digit course codes working.
	return /^\d{6}$/.test(trimmed)
		? `0${trimmed.slice(0, 3)}0${trimmed.slice(3)}`
		: trimmed;
}

export function getSearchOptions(courses: FullCourse[]) {
	const faculties = Array.from(
		new Set(
			courses
				.map((course) => course.faculty)
				.filter((faculty): faculty is string => !!faculty?.trim())
		)
	).toSorted((a, b) => a.localeCompare(b));
	const maxPoints =
		Math.ceil(
			courses.reduce(
				(max, course) =>
					Number.isFinite(course.points)
						? Math.max(max, course.points ?? 0)
						: max,
				0
			) * 2
		) / 2;
	return { faculties, maxPoints };
}

export function readSearchFilters(
	params: URLSearchParams,
	maxPoints: number
): SearchFilters {
	let pointsMin = roundedFilterNumber(
		finiteNumber(params.get('pointsMin')) ?? 0,
		0,
		maxPoints
	);
	let pointsMax = roundedFilterNumber(
		finiteNumber(params.get('pointsMax')) ?? maxPoints,
		0,
		maxPoints
	);
	if (pointsMin > pointsMax) [pointsMin, pointsMax] = [pointsMax, pointsMin];
	return {
		available: params.has('available'),
		faculty: params.get('faculty')?.trim() ?? '',
		pointsMin,
		pointsMax,
		medianMin: roundedFilterNumber(
			finiteNumber(params.get('medianMin')) ?? 0,
			0,
			100
		)
	};
}

export function writeSearchFilters(
	params: URLSearchParams,
	filters: SearchFilters,
	maxPoints: number
) {
	searchFilterKeys.forEach((key) => params.delete(key));
	if (filters.available) params.set('available', '');
	if (filters.faculty) params.set('faculty', filters.faculty);
	if (filters.pointsMin > 0) params.set('pointsMin', String(filters.pointsMin));
	if (filters.pointsMax < maxPoints)
		params.set('pointsMax', String(filters.pointsMax));
	if (filters.medianMin > 0) params.set('medianMin', String(filters.medianMin));
}

export function hasSearchFilters(
	filters: SearchFilters,
	maxPoints: number
): boolean {
	return (
		filters.available ||
		!!filters.faculty ||
		filters.pointsMin > 0 ||
		filters.pointsMax < maxPoints ||
		filters.medianMin > 0
	);
}

export function searchCourses(
	courses: FullCourse[],
	query: string
): FullCourse[] {
	return courses
		.filter(
			(course) =>
				course.code.includes(query) ||
				course.name?.includes(query) ||
				course.about?.includes(query)
		)
		.toSorted((a, b) => (b.median ?? 0) - (a.median ?? 0));
}

export function matchesSearchFilters(
	course: FullCourse,
	filters: SearchFilters,
	maxPoints: number
): boolean {
	if (filters.available && !course.current) return false;
	if (filters.faculty && course.faculty !== filters.faculty) return false;
	if (filters.pointsMin > 0 || filters.pointsMax < maxPoints) {
		if (
			course.points === undefined ||
			!Number.isFinite(course.points) ||
			course.points < filters.pointsMin ||
			course.points > filters.pointsMax
		)
			return false;
	}
	if (
		filters.medianMin > 0 &&
		(course.median === undefined ||
			!Number.isFinite(course.median) ||
			course.median < filters.medianMin)
	)
		return false;
	return true;
}

export function createSearchUrl(currentUrl: URL, query: string): URL {
	const url = new URL('/app/search', currentUrl);
	if (currentUrl.pathname === '/app/search') url.search = currentUrl.search;
	url.searchParams.set('q', query);
	return url;
}
