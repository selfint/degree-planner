import { getCourseData } from './courseData';

function applyOverflow(progresses: Progress[]): Progress[] {
	const nestedProgressMap = new Map<string, Progress>(
		progresses.map((p) => [p.name, p])
	);

	for (const p of progresses) {
		const overflow = p.overflow;
		if (overflow === undefined) {
			continue;
		}

		const targetProgress = nestedProgressMap.get(overflow.target);
		if (targetProgress === undefined) {
			// TODO: throw error or log warning
			continue;
		}

		if (overflow.type === 'points') {
			targetProgress.points.done += overflow.value;
		} else {
			targetProgress.count.done += overflow.value;
		}
	}

	return progresses;
}

export function getRequirementCourses(requirement: Requirement): string[] {
	if (requirement.courses !== undefined) {
		return requirement.courses;
	} else {
		return requirement.nested?.flatMap(getRequirementCourses) ?? [];
	}
}

export function requirementCompleted(progress: Progress): boolean {
	if (progress.points.required > progress.points.done) {
		return false;
	}

	if (progress.count.required > progress.count.done) {
		return false;
	}

	if (progress.amount.required > progress.amount.done) {
		return false;
	}

	return true;
}

export function getProgress(
	semesters: Course[][],
	requirement: Requirement,
	_getCourseData: (code: string) => Course = getCourseData
): Progress {
	const requirementCourses = getRequirementCourses(requirement);
	const relevantCourses = semesters
		.flat()
		.filter((course) => requirementCourses.includes(course.code));

	const points = relevantCourses.reduce(
		(sum, course) => sum + (course.points ?? 0),
		0
	);

	const count = relevantCourses.length;

	let overflow = undefined;
	if (requirement.overflow !== undefined) {
		const [type, progress, base] =
			requirement.points !== undefined
				? (['points', points, requirement.points] as const)
				: // TODO: is there a more type safe way to do this?
					(['count', count, requirement.count!] as const);

		const value = progress - base;
		if (value > 0) {
			overflow = { target: requirement.overflow, type, value } as const;
		}
	}

	const options = applyOverflow(
		(requirement.nested ?? []).map((nested) =>
			getProgress(semesters, nested, _getCourseData)
		)
	);

	const done = options.filter(requirementCompleted);
	const amount = done.length;

	return {
		name: requirement.name,
		he: requirement.he,
		courses: {
			done: relevantCourses,
			options: requirementCourses.map(_getCourseData)
		},
		points: { done: points, required: requirement.points ?? 0 },
		count: { done: count, required: requirement.count ?? 0 },
		overflow: overflow,
		nested: { done, options },
		amount: {
			done: amount,
			required: requirement.amount ?? requirement.nested?.length ?? 0
		}
	};
}
