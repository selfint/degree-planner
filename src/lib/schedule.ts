import { getCourseData } from './courseData';

type ScheduleError = {
	dependencies: { course: Course; taken: boolean }[][];
	adjacencies: { course: Course; taken: boolean }[];
	exclusives: Course[];
};

export async function getScheduleError(
	course: Course,
	semesters: string[][],
	currentSemester: number
): Promise<ScheduleError> {
	const semester = semesters[currentSemester];
	const previous = semesters.slice(0, currentSemester).flat();

	function dependencyTaken(course: Course): boolean {
		return (
			previous.includes(course.code) ||
			(course.connections?.exclusive ?? []).some((c) => previous.includes(c))
		);
	}

	function adjacencyTaken(course: Course): boolean {
		return (
			dependencyTaken(course) ||
			semester.includes(course.code) ||
			(course.connections?.exclusive ?? []).some((c) => semester.includes(c))
		);
	}

	const dependencies = await Promise.all(
		(course.connections?.dependencies ?? []).map(
			async (group) => await Promise.all(group.map(getCourseData))
		)
	).then((dep) =>
		dep
			.map((g) => g.filter((c) => (c.name ?? '').includes('-')))
			.filter((g) => g.length > 0)
	);
	const adjacencies = await Promise.all(
		(course.connections?.adjacent ?? []).map(getCourseData)
	).then((adj) => adj.filter((c) => (c.name ?? '').includes('-')));

	const dependenciesSatisfied =
		dependencies.length === 0 ||
		dependencies.some((group) => group.every(dependencyTaken));

	const adjacenciesSatisfied =
		adjacencies.length === 0 || adjacencies.some(adjacencyTaken);

	return {
		dependencies: dependenciesSatisfied ? [] : dependencies
	};
}
