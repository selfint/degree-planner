import { writable } from 'svelte/store';
import type { ShellReadiness } from '../../src/lib/pwa/shell-readiness';

export type OfflineShellStatus = {
	status: ShellReadiness;
	updateReady: boolean;
	error?: string;
};
const state = writable<OfflineShellStatus>({
	status: 'preparing',
	updateReady: false
});
export const offlineShellStatus = { subscribe: state.subscribe };
export const publishOfflineShellStatus = state.set;
