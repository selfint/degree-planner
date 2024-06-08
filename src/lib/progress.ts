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

function checkRequirementCompleted(
	requirement: Requirement,
	progress: RequirementProgress
): boolean {
	if (requirement.points !== undefined) {
		return (progress.points ?? -1) >= requirement.points;
	}

	if (requirement.count !== undefined) {
		return (progress.count ?? -1) >= requirement.count;
	}

	if (requirement.choice !== undefined) {
		const completedOptions = Array.from(
			progress.choice?.options?.values() ?? []
		).filter(([subRequirement, subProgress]) =>
			checkRequirementCompleted(subRequirement, subProgress)
		);

		return completedOptions.length >= requirement.choice.amount;
	}

	return false;
}

async function getRequirementProgress(
	semesters: string[][],
	getCourseData: (code: string) => Promise<Course>,
	requirement: Requirement
): Promise<RequirementProgress> {
	const courses = getRequirementCourses(requirement);
	const relevantCourses = [
		...new Set(semesters.flat().filter((course) => courses.includes(course)))
	];

	let progress = {};

	if (requirement.points !== undefined) {
		let points = 0;
		for (const course of relevantCourses) {
			points += (await getCourseData(course))?.points ?? 0;
		}

		// @ts-expect-error
		progress.points = points;

		// @ts-expect-error
		progress.courses = relevantCourses;
	}

	if (requirement.count !== undefined) {
		// @ts-expect-error
		progress.count = relevantCourses.length;

		// @ts-expect-error
		progress.courses = relevantCourses;
	}

	if (requirement.choice !== undefined) {
		let choiceProgress = new Map();

		let amount = 0;
		const options = Array.from(requirement.choice.options);
		for (const [option, subRequirement] of options) {
			const subProgress = await getRequirementProgress(
				semesters,
				getCourseData,
				subRequirement
			);

			choiceProgress.set(option, subProgress);

			if (checkRequirementCompleted(subRequirement, subProgress)) {
				amount++;
			}
		}

		// @ts-expect-error
		progress.choice = {
			amount,
			options: choiceProgress
		};
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
