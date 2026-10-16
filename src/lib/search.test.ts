import { describe, expect, it } from 'vitest';
import {
	createSearchUrl,
	getSearchOptions,
	hasSearchFilters,
	matchesSearchFilters,
	normalizeSearchQuery,
	readSearchFilters,
	resolveNumericFilterInput,
	searchCourses,
	searchFilterKeys,
	writeSearchFilters
} from './search';

const courses: FullCourse[] = [
	{
		code: '01040183',
		name: 'Algebra',
		faculty: 'Math',
		points: 2,
		median: 100,
		current: false
	},
	{
		code: '01040184',
		name: 'Algebra 2',
		faculty: 'Math',
		points: 2.5,
		median: 90,
		current: true
	},
	{
		code: '01040181',
		name: 'Analysis',
		about: 'Algebra applications',
		faculty: 'Physics',
		points: 5,
		median: 80,
		current: true
	},
	{ code: '01040185', name: 'Unknown', current: true }
];
const defaults = readSearchFilters(new URLSearchParams(), 5);

function filtered(params: string) {
	const filters = readSearchFilters(new URLSearchParams(params), 5);
	return courses.filter((course) => matchesSearchFilters(course, filters, 5));
}

describe('search filter options and URLs', () => {
	it('sorts unique nonempty faculties and derives half-point upper bounds', () => {
		expect(
			getSearchOptions([
				...courses,
				{ code: '01040182', faculty: 'Math', points: 5.2 },
				{ code: '01040163', faculty: ' ', points: NaN }
			])
		).toEqual({ faculties: ['Math', 'Physics'], maxPoints: 5.5 });
		expect(getSearchOptions([])).toEqual({ faculties: [], maxPoints: 0 });
	});
	it('defaults missing, empty, and nonfinite numeric values', () => {
		expect(defaults).toEqual({
			available: false,
			faculty: '',
			pointsMin: 0,
			pointsMax: 5,
			medianMin: 0
		});
		expect(
			readSearchFilters(
				new URLSearchParams(
					'pointsMin=NaN&pointsMax=Infinity&medianMin=bad&faculty=%20'
				),
				5
			)
		).toEqual(defaults);
		expect(
			readSearchFilters(
				new URLSearchParams('pointsMin=&pointsMax=%20&medianMin='),
				5
			)
		).toEqual(defaults);
	});
	it('clamps limits, swaps inverted point ranges, and retains fractional values', () => {
		expect(
			readSearchFilters(
				new URLSearchParams('pointsMin=9&pointsMax=-2&medianMin=120'),
				5
			)
		).toEqual({ ...defaults, medianMin: 100 });
		expect(
			readSearchFilters(
				new URLSearchParams('pointsMin=4.5&pointsMax=2.5&medianMin=85.7'),
				5
			)
		).toEqual({ ...defaults, pointsMin: 2.5, pointsMax: 4.5, medianMin: 85.7 });
	});
	it('treats minimum median zero as inactive, including when negative', () => {
		expect(filtered('medianMin=0')).toEqual(courses);
		expect(filtered('medianMin=-5')).toEqual(courses);
		expect(hasSearchFilters(defaults, 5)).toBe(false);
	});
	it('round-trips filters and removes defaults without changing the query', () => {
		const params = new URLSearchParams('q=Algebra%26analysis&extra=keep');
		const filters = {
			available: true,
			faculty: 'Math & Physics',
			pointsMin: 1.5,
			pointsMax: 4.5,
			medianMin: 85.5
		};
		writeSearchFilters(params, filters, 5);
		expect(readSearchFilters(params, 5)).toEqual(filters);
		expect(hasSearchFilters(filters, 5)).toBe(true);
		writeSearchFilters(params, defaults, 5);
		expect(params.get('q')).toBe('Algebra&analysis');
		expect(params.get('extra')).toBe('keep');
		searchFilterKeys.forEach((key) => expect(params.has(key)).toBe(false));
	});
	it('preserves filters and safely encodes a new search term on the search page', () => {
		const url = createSearchUrl(
			new URL('https://example.com/search?q=old&faculty=Math&available#old'),
			'A&B + #?'
		);
		expect(url.pathname).toBe('/search');
		expect(url.hash).toBe('');
		expect(url.searchParams.get('q')).toBe('A&B + #?');
		expect(url.searchParams.get('faculty')).toBe('Math');
		expect(url.searchParams.has('available')).toBe(true);
		expect(
			createSearchUrl(
				new URL('https://example.com/semester?index=2'),
				'Algebra'
			).search
		).toBe('?q=Algebra');
	});
});

describe('course filtering', () => {
	it('leaves missing metadata visible when filters are inactive', () => {
		expect(filtered('')).toEqual(courses);
		expect(filtered('pointsMin=0&pointsMax=5')).toEqual(courses);
	});
	it('combines availability, faculty, points and median inclusively', () => {
		expect(
			filtered(
				'available&faculty=Math&pointsMin=2.5&pointsMax=2.5&medianMin=90'
			)
		).toEqual([courses[1]]);
		expect(filtered('faculty=Physics&medianMin=81')).toEqual([]);
		expect(filtered('faculty=Unknown')).toEqual([]);
	});
	it('excludes unknown metadata only for active filters', () => {
		expect(filtered('available')).toContain(courses[3]);
		expect(filtered('pointsMin=0.5')).not.toContain(courses[3]);
		expect(filtered('pointsMax=4')).not.toContain(courses[3]);
		expect(filtered('medianMin=1')).not.toContain(courses[3]);
	});
	it('supports half-point limits and exact zero-point searches', () => {
		expect(filtered('pointsMin=2.5&pointsMax=4.5')).toEqual([courses[1]]);
		const filters = readSearchFilters(new URLSearchParams('pointsMax=0'), 5);
		expect(
			matchesSearchFilters({ code: '01040182', points: 0 }, filters, 5)
		).toBe(true);
		expect(matchesSearchFilters(courses[0], filters, 5)).toBe(false);
	});
	it('rejects nonfinite metadata for active numeric filters', () => {
		expect(
			matchesSearchFilters(
				{ ...courses[0], points: NaN },
				{ ...defaults, pointsMin: 1 },
				5
			)
		).toBe(false);
		expect(
			matchesSearchFilters(
				{ ...courses[0], median: Infinity },
				{ ...defaults, medianMin: 1 },
				5
			)
		).toBe(false);
	});
	it('retains code/name/description matching and descending median order', () => {
		expect(searchCourses(courses, 'Algebra')).toEqual(courses.slice(0, 3));
		expect(searchCourses(courses, '01040184')).toEqual([courses[1]]);
		expect(searchCourses(courses, '')).toEqual(courses);
		expect(searchCourses(courses, 'No match')).toEqual([]);
	});
	it('normalizes legacy six-digit codes and surrounding whitespace only', () => {
		expect(normalizeSearchQuery(' 104184 ')).toBe('01040184');
		expect(normalizeSearchQuery(' 01040184 ')).toBe('01040184');
		expect(normalizeSearchQuery(' Algebra ')).toBe('Algebra');
	});
});

describe('committed numeric filter fields', () => {
	it('preserves floats without integer or half-point rounding', () => {
		expect(resolveNumericFilterInput('2.25', 0, 20, 0, 1)).toBe(2.25);
		expect(resolveNumericFilterInput('85.125', 0, 100, 0, 80)).toBe(85.125);
		expect(resolveNumericFilterInput('0.05', 0, 20, 0, 1)).toBe(0.05);
	});
	it('resets empty committed fields to their individual defaults', () => {
		expect(resolveNumericFilterInput('', 0, 20, 0, 2.25)).toBe(0);
		expect(resolveNumericFilterInput(' ', 2.25, 20, 20, 4.75)).toBe(20);
		expect(resolveNumericFilterInput('', 0, 100, 0, 85.5)).toBe(0);
	});
	it('retains the previous value for invalid or unfinished numeric input', () => {
		for (const value of ['NaN', 'Infinity', 'abc', '1e', '-']) {
			expect(resolveNumericFilterInput(value, 0, 20, 0, 2.25)).toBe(2.25);
		}
		// Native number inputs expose unfinished numeric text as empty with badInput set.
		expect(resolveNumericFilterInput('', 0, 20, 0, 2.25, true)).toBe(2.25);
	});
	it('clamps values to both the course bounds and the other range endpoint', () => {
		expect(resolveNumericFilterInput('-1.5', 0, 20, 0, 2)).toBe(0);
		expect(resolveNumericFilterInput('999', 0, 20, 0, 2)).toBe(20);
		expect(resolveNumericFilterInput('6', 0, 4.75, 0, 2)).toBe(4.75);
		expect(resolveNumericFilterInput('1', 2.25, 20, 20, 4)).toBe(2.25);
		expect(resolveNumericFilterInput('100.5', 0, 100, 0, 85)).toBe(100);
	});
});
