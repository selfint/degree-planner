import { readable } from 'svelte/store';

/** No offline plan-edit queue: reconnect before starting a new mutation. */
export function isPlanWritable(): boolean {
	return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export class OfflinePlanWriteError extends Error {
	constructor() {
		super('Plan editing and saving require an internet connection.');
		this.name = 'OfflinePlanWriteError';
	}
}

/** Recheck at the write boundary, in case a previously enabled control was clicked. */
export function assertPlanWritable(): void {
	if (!isPlanWritable()) throw new OfflinePlanWriteError();
}

export const planOnline = readable(isPlanWritable(), (set) => {
	if (typeof window === 'undefined') return;
	const update = () => set(isPlanWritable());
	update();
	window.addEventListener('online', update);
	window.addEventListener('offline', update);
	window.addEventListener('pageshow', update);
	return () => {
		window.removeEventListener('online', update);
		window.removeEventListener('offline', update);
		window.removeEventListener('pageshow', update);
	};
});
