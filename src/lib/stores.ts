import { writable } from 'svelte/store';

export const username = writable<string | undefined>(undefined);
export const degree = writable<Degree | undefined>(undefined);
export const semesters = writable<string[][] | undefined>(undefined);
export const currentSemester = writable<number | undefined>(undefined);
