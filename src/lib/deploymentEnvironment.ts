import * as publicEnv from '$env/static/public';

/** Build-time policy. Staging never initializes telemetry, even with live keys. */
export const isStaging =
	(publicEnv as Record<string, string>).PUBLIC_DEPLOYMENT_ENV === 'staging';
// This shared gate covers PostHog, Firebase/Google Analytics and Vercel SDKs.
// Loopback also covers Playwright against a normal production build.
const hostname = typeof window === 'undefined' ? '' : window.location?.hostname;
const local =
	hostname === 'localhost' ||
	hostname?.endsWith('.localhost') ||
	hostname === '::1' ||
	hostname === '[::1]' ||
	/^127\./.test(hostname ?? '');
export const analyticsEnabled =
	!import.meta.env.DEV &&
	import.meta.env.MODE !== 'test' &&
	!isStaging &&
	!local;

/** Firebase SDK authentication intentionally remains shared; only app-owned state is scoped. */
export function storageKey(key: string): string {
	return isStaging ? `planit.staging.${key}` : key;
}
