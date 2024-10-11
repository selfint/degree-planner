import { getCourseData } from './courseData';

export type ScheduleError = {
	dependencies: { course: Course; taken: boolean }[][];
	adjacencies: { course: Course; taken: boolean }[];
	exclusives: Course[];
	season?: string[];
};

export function getScheduleError(
	course: Course,
	semesters: string[][],
	currentSemester: number,
	ignoreUndefined = false
): ScheduleError {
	const semester = semesters[currentSemester];
	const previous = semesters.slice(0, currentSemester).flat();

	// type gymnastics for typescript
	type Season = 'Winter' | 'Spring' | 'Summer';
	const seasons = ['Winter', 'Spring', 'Summer'] as const;

	const currentSeason = seasons[currentSemester % 3];
	const courseSeason: Season[] | undefined = course.seasons;

	const seasonError =
		courseSeason !== undefined && !courseSeason.includes(currentSeason);

	function dependencyTaken(course: Course): boolean {
		if (ignoreUndefined && course.name === undefined) {
			return true;
		}

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
		.filter((g) => g.length > 0);
	const adjacencies = (course.connections?.adjacent ?? []).map((c) =>
		getCourseData(c)
	);

	const dependenciesSatisfied =
		dependencies.length === 0 ||
		dependencies.some((group) => group.every((c) => dependencyTaken(c)));

	const adjacenciesSatisfied =
		adjacencies.length === 0 || adjacencies.some(adjacencyTaken);

	return {
		dependencies: dependenciesSatisfied
			? []
			: dependencies.map((g) =>
					g.map((c) => ({ course: c, taken: dependencyTaken(c) }))
				),
		adjacencies: adjacenciesSatisfied
			? []
			: adjacencies.map((c) => ({ course: c, taken: adjacencyTaken(c) })),
		exclusives: [],
		season: seasonError ? courseSeason : undefined
	};
}
