import { writable, type Writable, get } from 'svelte/store';

export const courses = writable<Course[]>([]);
export const wishlist = writable<string[]>([]);
export const years = writable<Writable<Year>[]>([]);
export const groups = writable<Writable<Group>[]>([]);
export const totalPoints = writable<number>(0);

export type State = {
	courses: Course[];
	wishlist: string[];
	years: Year[];
	groups: { name: string; points: number; courses: string[] }[];
	totalPoints: number;
};

export function saveStores() {
	const state: State = {
		courses: get(courses),
		wishlist: get(wishlist),
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
	if (
		['courses', 'wishlist', 'years', 'groups', 'totalPoints'].some(
			(key) => !Object.hasOwn(state, key)
		)
	) {
		return;
	}
	console.log(['Loading', data.length, state]);

	courses.set(state.courses);
	wishlist.set(state.wishlist);

	const fullCourses = new Map(state.courses.map((course) => [course.code, course]));
	function getFullCourse(code: string): Course {
		return fullCourses.get(code) as Course;
	}

	years.set(
		state.years.map((year) =>
			writable({
				...year,
				winter: year.winter.filter((c) => getFullCourse(c) !== undefined),
				spring: year.spring.filter((c) => getFullCourse(c) !== undefined),
				summer: year.summer.filter((c) => getFullCourse(c) !== undefined)
			})
		)
	);
	groups.set(
		state.groups.map((group) =>
			writable({
				name: group.name,
				points: group.points,
				courses: group.courses.map(getFullCourse).filter((c) => c?.info !== undefined)
			})
		)
	);

	totalPoints.set(state.totalPoints);
}

function sortCourses(array: Course[]) {
	const uniqueCourses = array.filter(
		(item, index, self) => index === self.findIndex((t) => t.code === item.code)
	);

	return uniqueCourses.sort((a, b) => {
		if (a.info?.median === b.info?.median) {
			return a.code.localeCompare(b.code);
		}

		if (a.info?.median === undefined) return 1;
		if (b.info?.median === undefined) return -1;

		return b.info?.median - a.info?.median;
	});
}

export function storeHook(): void {
	for (const store of [courses, years, groups, totalPoints, wishlist]) {
		store.subscribe(saveStores);
	}

	let groupsUnsubscribe = get(groups).map((group) =>
		group.subscribe(() =>
			courses.set(sortCourses(get(groups).flatMap((group) => get(group).courses)))
		)
	);

	groups.subscribe((value) => {
		for (const unsubscribe of groupsUnsubscribe) {
			unsubscribe();
		}
		groupsUnsubscribe = get(groups).map((group) =>
			group.subscribe(() =>
				courses.set(sortCourses(get(groups).flatMap((group) => get(group).courses)))
			)
		);
		courses.set(sortCourses(value.flatMap((group) => get(group).courses)));
	});
}
