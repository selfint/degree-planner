const cacheRoute = '/_cache/courseData/';
const courseData: CourseData = new Map();

export async function getAllCourses(): Promise<Course[]> {
	return await Promise.all(Array.from(courseData.values()));
}

export function getAllCoursesSync(): Promise<Course[]> {
	return Promise.all(Array.from(courseData.values()));
}

export function courseCodeIsValid(code: string): boolean {
	return /^\d{8}$/.test(code);
}

export function buildGetCourseData() {
	const abort = new AbortController();
	const abortSignal = abort.signal;

	return {
		getCourseData: (code: string) => getCourseData(code, { abortSignal }),
		abort: () => abort.abort()
	};
}

export async function getCourseDataBatch(
	codes: string[],
	opts?: { abortSignal?: AbortSignal }
): Promise<Course[]> {
	const newCodes = codes.filter((c) => !courseData.has(c));
	const oldCodes = codes.filter((c) => courseData.has(c));

	const serverRes = await fetch(`/api/courseInfo`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(newCodes),
		signal: opts?.abortSignal
	});

	const cacheRes = Promise.all(
		// these codes are all in the courseData map
		oldCodes.map((c) => courseData.get(c) as Promise<Course>)
	);

	let courses: Course[];
	if (serverRes.ok) {
		courses = await serverRes.json();
	} else {
		return await cacheRes;
	}

	for (const course of courses) {
		courseData.set(course.code, Promise.resolve(course));
	}

	return courses.concat(await cacheRes);
}

/**
 * Get course data for a course code
 * @param code Course code
 * @param opts options - abortSignal: AbortSignal to cancel the request
 * @returns Course object, will return only the course code if the course is not found
 */
export function getCourseData(
	code: string,
	opts?: { abortSignal?: AbortSignal }
): Promise<Course> {
	if (!courseCodeIsValid(code)) {
		return Promise.resolve({ code });
	}

	const data = courseData.get(code);
	if (data === undefined) {
		let done = false;
		async function getData(): Promise<Course> {
			// Fetch first from cache, then from server if cache fails
			try {
				const cacheRes = await fetch(cacheRoute + code + '.json', {
					signal: opts?.abortSignal
				});
				if (cacheRes.ok) {
					done = true;
					return cacheRes.json();
				}
			} catch (e) {
				//
			}

			try {
				const serverRes = await fetch(`/api/courseInfo/${code}`, {
					signal: opts?.abortSignal
				});

				if (serverRes.ok) {
					done = true;
					return serverRes.json();
				}
			} catch (e) {
				//
			}

			return {
				code
			};
		}

		const future = getData()
			// start fetching dependencies
			.then((course) => {
				course.connections?.dependencies.forEach((dep) => {
					dep.forEach((code) => {
						getCourseData(code);
					});
				});

				return course;
			});
		courseData.set(code, future);

		if (opts?.abortSignal) {
			opts.abortSignal.addEventListener('abort', () => {
				if (!done) {
					courseData.delete(code);
				}
			});
		}

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
