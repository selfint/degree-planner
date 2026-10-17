/** Shared visibility gate; this does not move, erase, or synchronize plan data. */
export const PERSONAL_PLAN_READY = Symbol('personal-plan-ready');

export function canShowPersonalPlan({
	authReady,
	signedIn,
	offline,
	cloudPlanUnavailable
}: {
	authReady: boolean;
	signedIn: boolean;
	offline: boolean;
	cloudPlanUnavailable: boolean;
}): boolean {
	return authReady && (!signedIn || (!offline && !cloudPlanUnavailable));
}
