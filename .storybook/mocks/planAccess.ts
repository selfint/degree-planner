import { get, writable } from 'svelte/store';
export const planOnline = writable(true);
export const isPlanWritable = () => get(planOnline);
export class OfflinePlanWriteError extends Error {}
export function assertPlanWritable() {
	if (!isPlanWritable()) throw new OfflinePlanWriteError();
}
