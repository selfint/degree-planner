import { writable } from 'svelte/store';
import type { OfflinePublicDataState } from '../../src/lib/offlineData';
export type { OfflinePublicDataState };

// Memory-only presentation fixtures: never open a database or prepare public data.
const state = writable<OfflinePublicDataState>({
	phase: 'idle',
	courseCount: 0
});
export const subscribeOfflinePublicData = state.subscribe;
export const setOfflinePublicData = state.set;
