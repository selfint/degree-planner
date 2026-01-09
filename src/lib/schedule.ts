import { getCourseData } from './courseData';

export function getScheduleError(
	course: Course,
	exemptions: string[],
	semesters: string[][],
	currentSemester: number,
	ignoreUndefined = false
): ScheduleError {
	const semester = semesters[currentSemester];
	const previous = [
		...semesters.slice(0, currentSemester).flat(),
		...exemptions
	];

	// type gymnastics for typescript
	type Season = 'Winter' | 'Spring' | 'Summer';
	const seasons = ['Winter', 'Spring', 'Summer'] as const;

	const currentSeason = seasons[currentSemester % 3];
	const courseSeason: Season[] | undefined = course.seasons;

	const seasonError =
		courseSeason !== undefined && !courseSeason.includes(currentSeason);

	function dependencyTaken(course: Course): boolean {
		return (
			previous.includes(course.code) ||
			(course.connections?.exclusive ?? []).some((c) => previous.includes(c))
		);
	}

	function adjacencyTaken(course: Course): boolean {
		if (ignoreUndefined && course.name === undefined) {
			return true;
		}

		return (
			dependencyTaken(course) ||
			semester.includes(course.code) ||
			(course.connections?.exclusive ?? []).some((c) => semester.includes(c))
		);
	}

	const dependencies = (course.connections?.dependencies ?? [])
		.map((group) => group.map((c) => getCourseData(c)))
		.map((g) => {
			if (ignoreUndefined) {
				return g.filter((c) => c.name !== undefined);
			} else {
				return g;
			}
		})
		.filter((g) => g.length > 0);
	const adjacencies = (course.connections?.adjacent ?? []).map((c) =>
		getCourseData(c)
	);

	const dependenciesSatisfied =
		dependencies.length === 0 ||
		dependencies.some((group) => group.every((c) => dependencyTaken(c)));

	const adjacenciesSatisfied =
		adjacencies.length === 0 || adjacencies.some(adjacencyTaken);

	function i18nSeasons(season: Season[]): number[] {
		return season.map((s) => seasons.indexOf(s));
	}

	const exclusives = (course.connections?.exclusive ?? []).filter(
		(c) => previous.some((p) => c === p) || semester.some((s) => c === s)
	);

	return {
		dependencies: dependenciesSatisfied
			? []
			: dependencies.map((g) =>
					g.map((c) => ({ course: c, taken: dependencyTaken(c) }))
				),
		adjacencies: adjacenciesSatisfied
			? []
			: adjacencies.map((c) => ({ course: c, taken: adjacencyTaken(c) })),
		exclusives: exclusives.map(getCourseData),
		season: seasonError ? i18nSeasons(courseSeason) : undefined
	};
}
