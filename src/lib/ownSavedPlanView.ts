/** In-memory provenance only. Neither these snapshots nor their contents leave the app. */
const persisted = new WeakMap<object, string>();
export function markPersistedPlan<T extends object>(data: T): T {
	persisted.set(data, JSON.stringify(data));
	return data;
}
export function isPersistedPlan(data: object): boolean {
	return persisted.get(data) === JSON.stringify(data);
}

/** Separate from personal-data availability: entry/update overlays must also be gone. */
export const OWN_PLAN_DISPLAY_READY = Symbol('own-plan-display-ready');

/** One decision per mounted plan visit. A new save is not a previously saved view. */
export function createOwnSavedPlanVisit(capture: () => void) {
	let decided = false;
	return ({
		ready,
		persisted,
		hasCourses,
		hasChanges
	}: {
		ready: boolean;
		persisted: boolean;
		hasCourses: boolean;
		hasChanges: boolean;
	}) => {
		if (!ready || decided) return;
		decided = true;
		if (persisted && hasCourses && !hasChanges) capture();
	};
}
