import { makeUser, pending, requirementFixture } from '../fixtures';
import { content } from './preferences.svelte';
import { assertPlanWritable } from './planAccess';
export { content };
export const user = $state({ d: makeUser() });
export const scenario = $state({
	loading: false,
	noDegree: false,
	transcript: 'default',
	signInError: false,
	pathChoices: false
});
export function setUser(data: UserData) {
	user.d = data;
}
export const writeStorage = async (data: UserData) => {
	assertPlanWritable();
	return data;
};
export const writeLocalStorage = writeStorage;
export const readStorage = async () => user.d;
export const setStorage = () => {};
export const localStorageMethod = { read: readStorage, write: writeStorage };
export const requirement = () =>
	scenario.noDegree
		? undefined
		: scenario.loading
			? pending<Requirement>()
			: Promise.resolve(requirementFixture);
export const degreeName = () =>
	scenario.loading
		? pending<string>()
		: Promise.resolve(
				content.lang.lang === 'he' ? 'תואר לדוגמה' : 'Example degree'
			);
