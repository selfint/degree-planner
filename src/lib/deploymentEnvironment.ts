import * as publicEnv from '$env/static/public';

/** Build-time policy. Staging never initializes telemetry, even with live keys. */
export const isStaging =
	(publicEnv as Record<string, string>).PUBLIC_DEPLOYMENT_ENV === 'staging';
export const analyticsEnabled = !isStaging;

/** Firebase SDK authentication intentionally remains shared; only app-owned state is scoped. */
export function storageKey(key: string): string {
	return isStaging ? `planit.staging.${key}` : key;
}
