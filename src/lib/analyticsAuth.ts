import type { AnalyticsAuthStatus } from './analyticsPolicy';

let status: AnalyticsAuthStatus = 'unknown';
const listeners = new Set<() => void>();
const observed = new WeakSet<object>();

export function analyticsAuthStatus(): AnalyticsAuthStatus {
	return status;
}

export function onAnalyticsAuthChange(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Observe only an auth instance the application already initialized. No IDs leave here. */
export function observeAnalyticsAuth(auth: {
	onAuthStateChanged(
		next: (user: object | null) => void,
		error: (error: unknown) => void
	): () => void;
}) {
	if (observed.has(auth)) return;
	observed.add(auth);
	const update = (next: AnalyticsAuthStatus) => {
		status = next;
		for (const listener of listeners) listener();
	};
	update('unknown');
	try {
		// Kept for this auth instance's lifetime so landing-page returns and
		// cross-tab login/logout keep reflecting the latest resolved state.
		auth.onAuthStateChanged(
			(user) => update(user === null ? 'signed_out' : 'signed_in'),
			() => update('unknown')
		);
	} catch {
		update('unknown');
	}
}
