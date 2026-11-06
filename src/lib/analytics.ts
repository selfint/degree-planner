import { analyticsAuthStatus, onAnalyticsAuthChange } from './analyticsAuth';
import { browser, dev } from '$app/environment';
import * as publicEnv from '$env/static/public';
// No optional extensions or remotely loaded scripts, even if project settings change.
import posthog, {
	type PostHog
} from 'posthog-js/dist/module.slim.no-external.js';
import {
	analyticsPage,
	anonymousId,
	privacyConfig,
	type AnalyticsEvent,
	type AnalyticsPage,
	type AnalyticsSource
} from './analyticsPolicy';

let client: PostHog | undefined;
let initialized = false;
let lastPage: AnalyticsPage | undefined;
let degreeSelected = false;
let pendingPage: { page: AnalyticsPage; timestamp: Date } | undefined;
let pendingTimer: ReturnType<typeof setTimeout> | undefined;

function flushPendingPage() {
	if (pendingTimer) clearTimeout(pendingTimer);
	pendingTimer = undefined;
	const pending = pendingPage;
	pendingPage = undefined;
	if (pending) capturePage(pending.page, pending.timestamp);
}

onAnalyticsAuthChange(() => {
	if (analyticsAuthStatus() !== 'unknown') flushPendingPage();
});

function capturePage(page: AnalyticsPage, timestamp: Date) {
	try {
		client?.capture(
			'$pageview',
			{ page, auth_status: analyticsAuthStatus() },
			{
				transport: 'sendBeacon',
				send_instantly: true,
				timestamp
			}
		);
	} catch {
		/* analytics is optional */
	}
}
const degreeMarker = 'planit.analytics.degree-selected.v1';
const browserIdKey = 'planit.analytics.browser-id.v1';

function browserId(): string {
	try {
		const saved = localStorage.getItem(browserIdKey);
		if (saved && anonymousId.test(saved)) return saved;
	} catch {
		/* storage may be unavailable */
	}
	const id = crypto.randomUUID();
	try {
		localStorage.setItem(browserIdKey, id);
	} catch {
		/* per-document identity only */
	}
	return id;
}

function initialize() {
	if (!browser || initialized) return;
	// Component stories and unrelated host routes must never pollute product metrics.
	if (!analyticsPage(window.location.pathname)) return;
	initialized = true;
	const config = publicEnv as Record<string, string>;
	const key = config.PUBLIC_POSTHOG_KEY?.trim();
	const host = config.PUBLIC_POSTHOG_HOST?.trim();
	if (!key || !host || (dev && config.PUBLIC_POSTHOG_ENABLE_DEV !== 'true'))
		return;
	try {
		const url = new URL(host);
		if (
			url.protocol !== 'https:' ||
			url.username ||
			url.password ||
			url.search ||
			url.hash
		)
			return;
		if (
			navigator.doNotTrack === '1' ||
			(navigator as Navigator & { globalPrivacyControl?: boolean })
				.globalPrivacyControl
		)
			return;
		client = posthog.init(
			key,
			{
				...privacyConfig,
				api_host: host,
				bootstrap: { distinctID: browserId(), isIdentifiedID: false }
			},
			'planit'
		);
		// Preserve short visits if the document leaves before auth resolves.
		window.addEventListener('pagehide', flushPendingPage);
	} catch {
		// Analytics must never prevent navigation, a save or an offline startup.
	}
}

export function trackEvent(
	event: Exclude<AnalyticsEvent, '$pageview'>,
	source?: AnalyticsSource
) {
	initialize();
	flushPendingPage();
	try {
		client?.capture(
			event,
			{
				page: analyticsPage(window.location.pathname),
				source,
				auth_status: analyticsAuthStatus()
			},
			{ transport: 'sendBeacon', send_instantly: true }
		);
	} catch {
		// Optional telemetry must not change the outcome of an application action.
	}
}

/** Only the root layout calls this, once after each completed navigation. */
export function trackPageView(pathname: string) {
	initialize();
	const page = analyticsPage(pathname);
	if (page === lastPage) return;
	// Resolve the previous visit before moving on; never relabel a departed
	// page using the authentication state from a later navigation.
	flushPendingPage();
	lastPage = page;
	if (!page || !client) return;
	const timestamp = new Date();
	if (page !== 'landing' && analyticsAuthStatus() === 'unknown') {
		pendingPage = { page, timestamp };
		// A short, bounded wait only for telemetry. App boot never awaits auth
		// for analytics, and lazy landing-page visits remain honestly unknown.
		pendingTimer = setTimeout(flushPendingPage, 1000);
	} else {
		capturePage(page, timestamp);
	}
}

/** No identity is attached: this is first selection per browser storage, not per account. */
export function trackFirstDegreeSelection(hadDegree: boolean) {
	initialize();
	if (!client) return;
	try {
		degreeSelected ||= localStorage.getItem(degreeMarker) === '1';
	} catch {
		/* memory fallback */
	}
	const first = !degreeSelected && !hadDegree;
	degreeSelected = true;
	try {
		localStorage.setItem(degreeMarker, '1');
	} catch {
		/* memory fallback */
	}
	if (first) trackEvent('degree_selected_first_time');
}

/** Call only after persistence succeeds. Reorders and removals are not additions. */
export function trackCourseAdditions(
	before: UserData,
	after: UserData,
	source: AnalyticsSource
) {
	for (const code of new Set(after.wishlist)) {
		if (!before.wishlist.includes(code))
			trackEvent('course_added_to_wishlist', source);
	}
	for (const [index, semester] of after.semesters.entries()) {
		for (const code of new Set(semester)) {
			if (!before.semesters[index]?.includes(code))
				trackEvent('course_added_to_semester', source);
		}
	}
}

/** One event per course moved between semesters, only after persistence succeeds. */
export function trackCourseMoves(before: UserData, after: UserData) {
	for (const code of new Set(before.semesters.flat())) {
		const leftSemester = before.semesters.some(
			(semester, index) =>
				semester.includes(code) && !after.semesters[index]?.includes(code)
		);
		const enteredSemester = after.semesters.some(
			(semester, index) =>
				semester.includes(code) && !before.semesters[index]?.includes(code)
		);
		if (leftSemester && enteredSemester)
			trackEvent('courses_shuffled', 'plan_board');
	}
}
