import { writable, type Writable, get } from 'svelte/store';

export const courses = writable<Course[]>([]);
export const semesters = writable<Writable<Course[]>[]>([]);
export const groups = writable<Writable<Group>[]>([]);
export const totalPoints = writable<number>(0);

export type State = {
	courses: Course[];
	semesters: string[][];
	groups: { name: string; points: number; courses: string[] }[];
	totalPoints: number;
};

export function saveStores() {
	const state: State = {
		courses: get(courses),
		semesters: get(semesters)
			.map(get)
			.map((semester) => semester.map((course) => course.code)),
		groups: get(groups)
			.map(get)
			.map((group) => {
				return {
					name: group.name,
					points: group.points,
					courses: group.courses.map((course) => course.code)
				};
			}),
		totalPoints: get(totalPoints)
	};

	const data = JSON.stringify(state);
	console.log(['Saving', data.length]);

	localStorage.setItem('state', data);
}

export function loadStores() {
	const data = localStorage.getItem('state');
	if (data === null) {
		return;
	}

	const state = JSON.parse(data) as State;
	console.log(['Loading', data.length]);

	courses.set(state.courses);
	const fullCourses = new Map(state.courses.map((course) => [course.code, course]));
	function getFullCourse(code: string): Course {
		return fullCourses.get(code) as Course;
	}
	semesters.set(state.semesters.map((courses) => writable(courses.map(getFullCourse))));
	groups.set(
		state.groups.map((group) =>
			writable({
				name: group.name,
				points: group.points,
				courses: group.courses.map(getFullCourse)
			})
		)
	);
	totalPoints.set(state.totalPoints);
}

export function storeHook(): void {
	for (const store of [courses, semesters, groups, totalPoints]) {
		store.subscribe(saveStores);
	}
}
