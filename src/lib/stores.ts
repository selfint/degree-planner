import { writable } from 'svelte/store';

function createSortedCoursesStore() {
	const { subscribe, set, update } = writable<CourseInfo[]>([]);

	function sortCourses(array: CourseInfo[]) {
		return array.slice().sort((a, b) => {
			if (a.median === b.median) {
				return a.code.localeCompare(b.code);
			}

			if (a.median === undefined) return 1;
			if (b.median === undefined) return -1;
			return b.median - a.median;
		});
	}

	return {
		subscribe,
		set: (courses: CourseInfo[]) => set(sortCourses(courses)),
		add: (course: CourseInfo) => update((courses) => sortCourses([...courses, course])),
		remove: (course: CourseInfo) =>
			update((numbers) => sortCourses(numbers.filter((n) => n !== course))),
		reset: () => set([])
	};
}

export const courses = createSortedCoursesStore();
