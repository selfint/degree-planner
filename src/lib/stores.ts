import { writable } from 'svelte/store';

export const courses = writable<Course[]>([]);
