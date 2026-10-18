import { readonly, writable } from 'svelte/store';
import type { ShellReadiness } from './shell-readiness';

export type OfflineShellStatus = {
	status: ShellReadiness;
	updateReady: boolean;
	error?: string;
};

// Presentation state only. PwaStatus owns the platform checks; the inline details read
// their results without registering another worker or changing cache state.
const shellStatus = writable<OfflineShellStatus>({
	status: 'preparing',
	updateReady: false
});
export const offlineShellStatus = readonly(shellStatus);

export function publishOfflineShellStatus(next: OfflineShellStatus) {
	shellStatus.update((current) => ({
		...next,
		// Rechecking is not recovery. Preserve the last failure until the
		// controlling worker verifies a usable shell (including an old version).
		error:
			next.status === 'ready' || next.status === 'outdated'
				? undefined
				: (next.error ?? current.error)
	}));
}
