export function getProgress(
	semesters: Course[][],
	requirements: DegreeRequirements
): DegreeProgress {
	const sumPoints = semesters
		.flat()
		.map((course) => course.points ?? 0)
		.reduce((a, b) => a + b, 0);

	const progress: [string, [Requirement, RequirementProgress]][] = Array.from(
		requirements.requirements
	).map(([name, requirement]) => [
		name,
		[requirement, getRequirementProgress(semesters, requirement)]
	]);

	// @ts-expect-error
	const overflows: [string, ProgressOverflow][] = progress
		.map(([name, [requirement, progress]]) => [
			name,
			getProgressOverflow(requirement, progress)
		])
		.filter(([_, overflow]) => overflow !== undefined);

	const requirementsProgress = new Map(progress);

	// handle overflow
	for (const [source, [targetName, kind, amount]] of overflows) {
		const target = requirementsProgress.get(targetName);
		if (target === undefined) {
			continue;
		}

		const [r, p] = target;

		if (kind === 'points') {
			p.points = (p.points ?? 0) + amount;
		} else if (kind === 'count') {
			p.count = (p.count ?? 0) + amount;
		}

		requirementsProgress.set(targetName, [r, p]);
	}

	return {
		points: [sumPoints, requirements.points],
		requirements: requirementsProgress
	};
}

function getProgressOverflow(
	requirement: Requirement,
	progress: RequirementProgress
): ProgressOverflow | undefined {
	if (requirement.overflow === undefined) {
		return undefined;
	}

	if (requirement.points !== undefined) {
		const overflow = (progress?.points ?? 0) - requirement.points;
		if (overflow > 0) {
			return [requirement.overflow, 'points', overflow];
		}
	}

	if (requirement.count !== undefined) {
		const overflow = (progress?.count ?? 0) - requirement.count;
		if (overflow > 0) {
			return [requirement.overflow, 'count', overflow];
		}
	}

	return undefined;
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

function getRequirementProgress(
	semesters: Course[][],
	requirement: Requirement
): RequirementProgress {
	const courses = getRequirementCourses(requirement);
	const relevantCourses = [
		...new Set(
			semesters.flat().filter((course) => courses.includes(course.code))
		)
	];

	let progress: RequirementProgress = {};

	if (requirement.points !== undefined) {
		let points = 0;
		for (const course of relevantCourses) {
			points += course?.points ?? 0;
		}

		progress.points = points;

		progress.courses = relevantCourses.map((c) => c.code);
	}

	if (requirement.count !== undefined) {
		progress.count = relevantCourses.length;

		progress.courses = relevantCourses.map((c) => c.code);
	}

	if (requirement.choice !== undefined) {
		let choiceProgress = new Map();

		let amount = 0;
		const options = Array.from(requirement.choice.options);
		for (const [option, subRequirement] of options) {
			const subProgress = getRequirementProgress(semesters, subRequirement);

			choiceProgress.set(option, [subRequirement, subProgress]);

			if (checkRequirementCompleted(subRequirement, subProgress)) {
				amount++;
			}
		}

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
