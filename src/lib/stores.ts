import { writable, get } from 'svelte/store';
import { loadDegreeData } from './requirements';
import { getProgress } from './progress';
import { getCourseData } from './courseData';

export const username = writable<string | undefined>(undefined);
export const degree = writable<Degree | undefined>(undefined);
export const semesters = writable<string[][]>([]);
export const currentSemester = writable<number>(0);
export const degreeData = writable<Promise<DegreeData> | undefined>(undefined);
export const degreeProgress = writable<Promise<DegreeProgress> | undefined>(
	undefined
);
export const wishlist = writable<string[]>([]);

export function storesHook() {
	username.subscribe(saveStores);
	degree.subscribe(saveStores);
	semesters.subscribe(saveStores);
	currentSemester.subscribe(saveStores);
	wishlist.subscribe(saveStores);
}

function saveStores() {
	const _username = get(username);
	const _degree = get(degree);
	const _semesters = get(semesters);
	const _currentSemester = get(currentSemester);
	const _wishlist = get(wishlist);

	if (_username !== undefined) {
		localStorage.setItem('username', _username);
	}

	if (_degree !== undefined) {
		localStorage.setItem('degree', JSON.stringify(_degree));
	}

	if (_semesters.length > 0) {
		localStorage.setItem('semesters', JSON.stringify(_semesters));
	}

	if (_currentSemester !== 0) {
		localStorage.setItem('currentSemester', _currentSemester.toString());
	}

	if (_wishlist.length > 0) {
		localStorage.setItem('wishlist', JSON.stringify(_wishlist));
	}
}

export function loadStores() {
	const _username = localStorage.getItem('username');
	const _degree = localStorage.getItem('degree');
	const _semesters = localStorage.getItem('semesters');
	const _currentSemester = localStorage.getItem('currentSemester');
	const _wishlist = localStorage.getItem('wishlist');

	if (_username !== null) {
		username.set(_username);
	}

	if (_degree !== null) {
		degree.set(JSON.parse(_degree));
		const _degreeData = loadDegreeData(JSON.parse(_degree));
		degreeData.set(_degreeData);
		degreeProgress.set(
			_degreeData.then((data) =>
				getProgress(
					JSON.parse(_semesters ?? '[]'),
					getCourseData,
					data.requirements
				)
			)
		);
	}

	if (_semesters !== null) {
		semesters.set(JSON.parse(_semesters));
	}

	if (_currentSemester !== null) {
		currentSemester.set(parseInt(_currentSemester));
	}

	if (_wishlist !== null) {
		wishlist.set(JSON.parse(_wishlist));
	}
}
