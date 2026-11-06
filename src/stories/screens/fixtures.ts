import type { FirebaseServices } from '$lib/firebase.svelte';
import type { OfflinePublicDataState } from '$lib/offlineData';
import {
	courses,
	courseData,
	getCourseData
} from '../../../.storybook/fixtures';

/** Route state only. No loader, persistence or network request is executed. */
export const routeState = (
	path: string,
	params: Record<string, string> = {},
	status = 200
) => ({
	state: {
		page: {
			url: new URL(path, 'https://storybook.example'),
			params,
			status,
			error: status >= 400 ? { message: 'Example route error' } : null
		}
	}
});

/** Attach a handler immediately so importing this fixture cannot reject globally. */
export function failed<T>(message: string): Promise<T> {
	const promise = Promise.reject<T>(new Error(message));
	void promise.catch(() => {});
	return promise;
}

/** Each render receives a fresh, memory-only auth session. */
export function makeFirebase(signedIn = false): FirebaseServices {
	type PreviewUser = { displayName: string } | null;
	let currentUser: PreviewUser = signedIn
		? { displayName: 'Example Student' }
		: null;
	const listeners = new Set<(user: PreviewUser) => void>();
	return {
		auth: {
			get currentUser() {
				return currentUser;
			},
			onAuthStateChanged(callback: (user: PreviewUser) => void) {
				listeners.add(callback);
				callback(currentUser);
				return () => {
					listeners.delete(callback);
				};
			},
			async signOut() {
				currentUser = null;
				listeners.forEach((callback) => callback(currentUser));
			}
		}
	} as unknown as FirebaseServices;
}

// Route components inherit these loader fields. The SDK object above deliberately
// implements only the auth contract they render, without initializing Firebase.
export const baseRouteData = {
	firebase: makeFirebase(),
	publicData: {
		phase: 'ready',
		courseCount: courses.length
	} satisfies OfflinePublicDataState,
	courseData: Promise.resolve(courseData),
	getCourseData
};
