import type {
	CaptureResult,
	PostHogConfig
} from 'posthog-js/dist/module.slim.no-external.js';
import { withoutBase, withBase } from './deploymentPaths';

export const analyticsPages = [
	'landing',
	'catalog',
	'plan',
	'settings',
	'semester',
	'share',
	'search',
	'course',
	'offline'
] as const;
export type AnalyticsPage = (typeof analyticsPages)[number];
export const analyticsEvents = [
	'$pageview',
	'start_clicked',
	'degree_selected_first_time',
	'grade_file_uploaded',
	'grade_import_saved',
	'course_added_to_wishlist',
	'course_added_to_semester',
	'share_plan_clicked',
	'copy_plan_clicked',
	'plan_copied'
] as const;
export type AnalyticsEvent = (typeof analyticsEvents)[number];
export type AnalyticsSource = 'course_detail' | 'plan_board';

/** Deliberately discard all identifiers, search terms, queries and fragments. */
export function analyticsPage(pathname: string): AnalyticsPage | undefined {
	const path = withoutBase(pathname).replace(/\/+$/, '') || '/';
	if (path === '/' || path === '/en') return 'landing';
	if (/^\/(?:share|app\/preview)\//.test(path)) return 'share';
	if (/^\/app\/course\//.test(path)) return 'course';
	const page = path.match(
		/^\/app\/(catalog|plan|settings|semester|search|offline)$/
	)?.[1];
	return page as AnalyticsPage | undefined;
}

function isPage(value: unknown): value is AnalyticsPage {
	return analyticsPages.includes(value as AnalyticsPage);
}
export const anonymousId =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fail closed: SDK defaults and future instrumentation cannot leak plan data. */
export function sanitizeAnalyticsEvent(
	event: CaptureResult | null
): CaptureResult | null {
	if (!event || !analyticsEvents.includes(event.event as AnalyticsEvent))
		return null;
	const input = event.properties;
	if (
		!input ||
		typeof input.distinct_id !== 'string' ||
		!anonymousId.test(input.distinct_id)
	)
		return null;
	if (event.event === '$pageview' && !isPage(input.page)) return null;
	const properties: Record<string, unknown> = {
		token: input.token,
		distinct_id: input.distinct_id,
		$process_person_profile: false,
		$geoip_disable: true
	};
	for (const key of ['$device_id', '$session_id', '$window_id']) {
		if (typeof input[key] === 'string' && anonymousId.test(input[key]))
			properties[key] = input[key];
	}
	if (isPage(input.page)) {
		properties.page = input.page;
		// A canonical path only, never location.href or a shared plan's real URL.
		properties.$pathname = withBase(
			input.page === 'landing'
				? '/'
				: input.page === 'share'
					? '/share'
					: `/app/${input.page}`
		);
	}
	if (
		['course_added_to_wishlist', 'course_added_to_semester'].includes(
			event.event
		) &&
		(input.source === 'course_detail' || input.source === 'plan_board')
	)
		properties.source = input.source;
	return {
		event: event.event,
		properties,
		timestamp: event.timestamp,
		uuid: event.uuid
	};
}

export const privacyConfig: Partial<PostHogConfig> = {
	autocapture: false,
	capture_pageview: false,
	capture_pageleave: false,
	disable_session_recording: true,
	capture_exceptions: false,
	capture_heatmaps: false,
	capture_performance: false,
	capture_dead_clicks: false,
	rageclick: false,
	disable_surveys: true,
	advanced_disable_flags: true,
	disable_external_dependency_loading: true,
	person_profiles: 'never',
	save_referrer: false,
	save_campaign_params: false,
	disableDeviceModel: true,
	disable_capture_url_hashes: true,
	// The SDK stores raw session-entry URLs even when referrer saving is off.
	// Keep its state in memory; analytics.ts persists only our random browser ID.
	persistence: 'memory',
	disable_persistence: true,
	persistence_name: 'planit_anonymous_analytics',
	cross_subdomain_cookie: false,
	respect_dnt: true,
	request_batching: false,
	before_send: sanitizeAnalyticsEvent
};
