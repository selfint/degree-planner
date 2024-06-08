export async function getProgress(
	semesters: string[][],
	getCourseData: (code: string) => Promise<Course>,
	requirements: DegreeRequirements
): Promise<DegreeProgress> {
	const courses = [
		...new Set(
			Array.from(requirements.requirements.values()).flatMap(
				getRequirementCourses
			)
		)
	];
	const points = await Promise.all(
		courses.map(async (course) => (await getCourseData(course))?.points ?? 0)
	);
	const sumPoints = points.reduce((a, b) => a + b, 0);

	const progress: [string, [Requirement, RequirementProgress]][] =
		await Promise.all(
			Array.from(requirements.requirements).map(async ([name, requirement]) => [
				name,
				[
					requirement,
					await getRequirementProgress(semesters, getCourseData, requirement)
				]
			])
		);

	return {
		points: [sumPoints, requirements.points],
		requirements: new Map(progress)
	};
}

async function getRequirementProgress(
	semesters: string[][],
	getCourseData: (code: string) => Promise<Course>,
	requirement: Requirement
): Promise<RequirementProgress> {
	const courses = getRequirementCourses(requirement);

	let progress = {
		courses: [
			...new Set(semesters.flat().filter((course) => courses.includes(course)))
		]
	};

	if (requirement.points !== undefined) {
		// @ts-expect-error
		progress.points = 0;
		for (const course of progress.courses) {
			// @ts-expect-error
			progress.points += (await getCourseData(course))?.points ?? 0;
		}
	}

	if (requirement.count !== undefined) {
		// @ts-expect-error
		progress.count = progress.courses.length;
	}

	return progress;
}

function getRequirementCourses(requirement: Requirement): string[] {
	if (requirement.courses !== undefined) {
		return requirement.courses;
	}

	if (requirement.choice !== undefined) {
		let courses: string[] = [];
		for (const [_, option] of requirement.choice.options) {
			courses.push(...getRequirementCourses(option));
		}

		return courses;
	}

	return [];
}
