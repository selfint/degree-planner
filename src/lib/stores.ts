import { writable } from 'svelte/store';

export const username = writable<string | undefined>(undefined);
export const degree = writable<[string, string] | undefined>(undefined);
export const plan = writable<string[][] | undefined>(undefined);
export const currentSemester = writable<number | undefined>(undefined);
