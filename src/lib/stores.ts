import { writable, type Writable, get } from 'svelte/store';

export const courses = writable<Course[]>([]);
export const years = writable<Writable<Year>[]>([]);
export const groups = writable<Writable<Group>[]>([]);
export const totalPoints = writable<number>(0);

export type State = {
	courses: Course[];
	years: Year[];
	groups: { name: string; points: number; courses: string[] }[];
	totalPoints: number;
};

export function saveStores() {
	const state: State = {
		courses: get(courses),
		years: get(years).map(get),
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
	console.log(['Saving', data.length, state]);

	localStorage.setItem('state', data);
}

export function loadStores() {
	const data = localStorage.getItem('state');
	if (data === null) {
		return;
	}

	const state = JSON.parse(data) as State;
	if (['courses', 'years', 'groups', 'totalPoints'].some((key) => !Object.hasOwn(state, key))) {
		return;
	}
	console.log(['Loading', data.length, state]);

	courses.set(state.courses);
	const fullCourses = new Map(state.courses.map((course) => [course.code, course]));
	function getFullCourse(code: string): Course {
		return fullCourses.get(code) as Course;
	}
	years.set(state.years.map((year) => writable(year)));
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
	for (const store of [courses, years, groups, totalPoints]) {
		store.subscribe(saveStores);
	}
}
