import { writable } from 'svelte/store';

export const username = writable<string | undefined>(undefined);
export const degree = writable<Degree | undefined>(undefined);
export const semesters = writable<string[][] | undefined>(undefined);
export const currentSemester = writable<number | undefined>(undefined);
export const degreeData = writable<Promise<DegreeData> | undefined>(undefined);
export const degreeProgress = writable<Promise<DegreeProgress> | undefined>(
	undefined
);

const courseData: CourseData = new Map();
export function getCourseData(code: string): Promise<Course> {
	const data = courseData.get(code);
	if (data === undefined) {
		const future = fetch(`/api/courseInfo/${code}`).then((res) => res.json());
		courseData.set(code, future);

		return future;
	} else {
		return data;
	}
}
