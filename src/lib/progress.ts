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
	const options = applyOverflow(
		(requirement.nested ?? []).map((nested) =>
			getProgress(semesters, nested, _getCourseData)
		)
	);

	const done = options.filter(requirementCompleted);
	const amount = done.length;

	const requirementCourses = getRequirementCourses(requirement);
	let relevantCourses = semesters
		.flat()
		.filter((course) => requirementCourses.includes(course.code));

	if (requirement.strict !== undefined && requirement.amount !== undefined) {
		const nested: string[] = done
			.toSorted((a, b) => {
				// check if we sort by points or count
				const byPoints = requirement.strict === 'points';
				const aSort = (byPoints ? a.points : a.count).done;
				const bSort = (byPoints ? b.points : b.count).done;

				return bSort - aSort;
			})
			// choose best nested options
			.slice(0, requirement.amount)
			.flatMap((p) => p.courses.done.map((c) => c.code));

		relevantCourses = relevantCourses.filter((course) =>
			nested.includes(course.code)
		);
	}

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

	return {
		name: requirement.name,
		courses: {
			done: relevantCourses,
			options: requirementCourses.map(_getCourseData)
		},
		points: { done: points, required: requirement.points ?? 0 },
		count: { done: count, required: requirement.count ?? 0 },
		nested: { done, options },
		amount: {
			done: amount,
			required: requirement.amount ?? requirement.nested?.length ?? 0
		},
		// ugly but short way to conditionally add properties
		...(requirement.he !== undefined ? { he: requirement.he } : {}),
		...(requirement.strict !== undefined ? { strict: requirement.strict } : {}),
		...(overflow !== undefined ? { overflow } : {})
	};
}
