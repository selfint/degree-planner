export async function getScheduleError(
	getCourseData: GetCourseData,
	course: Course,
	exemptions: string[],
	semesters: string[][],
	currentSemester: number,
	ignoreUndefined = false
): Promise<ScheduleError> {
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

	const dependencies = Promise.all(
		(course.connections?.dependencies ?? [])
			.map((group) => Promise.all(group.map(getCourseData)))
			.map((group) =>
				group.then((g) => {
					if (ignoreUndefined) {
						return g.filter((c) => c.name !== undefined);
					} else {
						return g;
					}
				})
			)
	).then((g) => g.filter((g) => g.length > 0));
	const adjacencies = Promise.all(
		(course.connections?.adjacent ?? []).map(getCourseData)
	);

	const dependenciesSatisfied = dependencies.then(
		(dependencies) =>
			dependencies.length === 0 ||
			dependencies.some((group) => group.every((c) => dependencyTaken(c)))
	);

	const adjacenciesSatisfied = adjacencies.then(
		(adjacencies) =>
			adjacencies.length === 0 || adjacencies.some(adjacencyTaken)
	);

	function i18nSeasons(season: Season[]): number[] {
		return season.map((s) => seasons.indexOf(s));
	}

	const exclusives = Promise.all(
		(course.connections?.exclusive ?? [])
			.filter(
				(c) => previous.some((p) => c === p) || semester.some((s) => c === s)
			)
			.map(getCourseData)
	);

	return {
		dependencies: (await dependenciesSatisfied)
			? []
			: (await dependencies).map((g) =>
					g.map((c) => ({ course: c, taken: dependencyTaken(c) }))
				),
		adjacencies: (await adjacenciesSatisfied)
			? []
			: (await adjacencies).map((c) => ({
					course: c,
					taken: adjacencyTaken(c)
				})),
		exclusives: await exclusives,
		season: seasonError ? i18nSeasons(courseSeason) : undefined
	};
}
