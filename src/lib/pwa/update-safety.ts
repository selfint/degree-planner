import { writable } from 'svelte/store';

/** A page owns its draft; a worker must never decide whether that draft is saved. */
export function createUpdateSafety() {
	const guards = new Set<() => boolean>();
	let pending = 0;
	let failed = false;
	let failureGeneration = 0;
	const state = writable(false);
	const blocked = () =>
		pending > 0 || failed || [...guards].some((guard) => guard());
	const refresh = () => state.set(blocked());
	return {
		subscribe: state.subscribe,
		blocked,
		refresh,
		register(guard: () => boolean) {
			guards.add(guard);
			refresh();
			return () => {
				guards.delete(guard);
				refresh();
			};
		},
		discardFailure() {
			failed = false;
			refresh();
		},
		async write<T>(operation: () => Promise<T>): Promise<T> {
			const generation = failureGeneration;
			pending++;
			refresh();
			try {
				const result = await operation();
				// An older in-flight success cannot erase a more recent failed save.
				if (generation === failureGeneration) failed = false;
				return result;
			} catch (error) {
				failed = true;
				failureGeneration++;
				throw error;
			} finally {
				pending--;
				refresh();
			}
		}
	};
}
export const updateSafety = createUpdateSafety();
