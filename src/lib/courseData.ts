const cacheRoute = '/_cache/courseData/';
const courseData: CourseData = new Map();

export function getCourseData(code: string): Promise<Course> {
	const data = courseData.get(code);
	if (data === undefined) {
		// Fetch first from cache, then from server if cache fails
		const future = fetch(cacheRoute + code + '.json')
			.then((res) => {
				if (res.ok) {
					return res.json();
				} else {
					throw new Error('failed fetching cached course data for ' + code);
				}
			})
			.catch(() => fetch(`/api/courseInfo/${code}`).then((res) => res.json()));

		courseData.set(code, future);

		return future;
	} else {
		return data;
	}
}

export function cacheDegreeCourses(degreeData: DegreeData): void {
	const courses = degreeData.recommended.flat();

	courses.push(
		...new Set(
			Array.from(degreeData.requirements.requirements.values()).flatMap(
				getRequirementCourses
			)
		)
	);

	courses.forEach((code) => {
		getCourseData(code);
	});
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
