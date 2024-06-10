import { writable } from 'svelte/store';

export const username = writable<string | undefined>(undefined);
export const degree = writable<Degree | undefined>(undefined);
export const semesters = writable<string[][]>([]);
export const currentSemester = writable<number>(0);
export const degreeData = writable<Promise<DegreeData> | undefined>(undefined);
export const degreeProgress = writable<Promise<DegreeProgress> | undefined>(
	undefined
);
export const wishlist = writable<string[]>([]);
