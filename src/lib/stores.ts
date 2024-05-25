import { writable, type Writable } from 'svelte/store';

export const courses = writable<Course[]>([]);
export const semesters = writable<Writable<Course[]>[]>([]);
