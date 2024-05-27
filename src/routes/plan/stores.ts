import { writable } from 'svelte/store';

export const selectedSemester = writable<[number, number] | undefined>(undefined);
export const selectedGroup = writable<Group | undefined>(undefined);
