import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ScriptTarget, transpileModule } from 'typescript';
import { get } from 'svelte/store';
import {
	setStorage,
	localStorageMethod,
	setUser,
	user,
	writeStorage
} from '../stores.svelte';
import { updateSafety } from './update-safety';

vi.mock('$app/environment', () => ({ browser: false }));

const planSource = readFileSync(
	new URL(
		'../../routes/app/(withCourseData)/plan/+page.svelte',
		import.meta.url
	),
	'utf8'
);
const save = planSource.match(
	/async function onSave\(\) \{[\s\S]*?\n\t\}/
)?.[0];
if (!save) throw new Error('Missing actual plan save handler');
const savePlan = new Function(
	'setUser',
	'writeStorage',
	'user',
	'wishlist',
	'semesters',
	transpileModule(`${save}; return onSave();`, {
		compilerOptions: { target: ScriptTarget.ES2022 }
	}).outputText
);
let remove = () => {};
afterEach(() => {
	remove();
	updateSafety.discardFailure();
	setStorage(localStorageMethod);
});

describe('actual plan Save and storage update boundary', () => {
	it('preserves the draft and blocks Update through pending, failure, and successful retry', async () => {
		const saved = {
			wishlist: [],
			semesters: [[]],
			exemptions: [],
			currentSemester: 0
		} as UserData;
		const wishlist = ['02340124'] as CourseCode[];
		const semesters = [[]] as CourseCode[][];
		setUser(saved);
		remove = updateSafety.register(
			() => wishlist !== user.d.wishlist || semesters !== user.d.semesters
		);
		let reject!: (error: Error) => void;
		const write = vi.fn(
			() =>
				new Promise<UserData>((_, fail) => {
					reject = fail;
				})
		);
		setStorage({ read: async () => saved, write });
		const pending = savePlan(setUser, writeStorage, user, wishlist, semesters);
		expect(get(updateSafety)).toBe(true);
		expect(updateSafety.blocked()).toBe(true);
		expect(user.d.wishlist).toEqual([]);
		reject(new Error('Fictional storage failure'));
		await expect(pending).rejects.toThrow('Fictional storage failure');
		expect(get(updateSafety)).toBe(true);
		expect(user.d.wishlist).toEqual([]);
		setStorage({ read: async () => saved, write: async (data) => data });
		await savePlan(setUser, writeStorage, user, wishlist, semesters);
		updateSafety.refresh();
		expect(user.d.wishlist).toEqual(wishlist);
		expect(updateSafety.blocked()).toBe(false);
		expect(get(updateSafety)).toBe(false);
	});
});
