export async function getScheduleError(
	getCourseData: GetCourseData,
	course: Promise<Course> | Course,
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

	course = await Promise.resolve(course);

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
		(course.connections?.dependencies ?? []).map((group) =>
			Promise.all(group.map(getCourseData))
		)
	).then((groups) => {
		// A code can satisfy an entire prerequisite alternative even when the
		// catalog has no name for it (for example, an exemption or placement test).
		if (
			groups.some((group) => group.length > 0 && group.every(dependencyTaken))
		) {
			return [];
		}

		// Preserve the Semester suggestions' existing advisory behavior for
		// unresolved unnamed requirements. Do not mistake a filtered-out group
		// for a satisfied group.
		const reportable = groups
			.map((group) =>
				ignoreUndefined
					? group.filter((course) => course.name !== undefined)
					: group
			)
			.filter((group) => group.length > 0);

		return reportable.some((group) => group.every(dependencyTaken))
			? []
			: reportable.map((group) =>
					group.map((course) => ({ course, taken: dependencyTaken(course) }))
				);
	});
	const adjacencies = Promise.all(
		(course.connections?.adjacent ?? []).map(getCourseData)
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
		dependencies: await dependencies,
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
