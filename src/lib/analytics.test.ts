import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
	analyticsPage,
	privacyConfig,
	sanitizeAnalyticsEvent
} from './analyticsPolicy';

const mocks = vi.hoisted(() => ({
	capture: vi.fn(),
	init: vi.fn(),
	env: {
		PUBLIC_DEPLOYMENT_ENV: 'production',
		PUBLIC_POSTHOG_KEY: 'phc_test_only',
		PUBLIC_POSTHOG_HOST: 'https://analytics.example.test',
		PUBLIC_POSTHOG_ENABLE_DEV: 'true'
	},
	runtime: { browser: true, dev: true }
}));
vi.mock('$app/environment', () => mocks.runtime);
vi.mock('$env/static/public', () => mocks.env);
vi.mock('posthog-js/dist/module.slim.no-external.js', () => ({
	default: { init: mocks.init }
}));
vi.mock('$app/paths', () => ({ base: '/degree-planner' }));
let values: Map<string, string>;
beforeEach(() => {
	vi.useFakeTimers();
	vi.resetModules();
	vi.clearAllMocks();
	mocks.runtime.browser = true;
	mocks.runtime.dev = true;
	mocks.env.PUBLIC_DEPLOYMENT_ENV = 'production';
	mocks.env.PUBLIC_POSTHOG_KEY = 'phc_test_only';
	mocks.env.PUBLIC_POSTHOG_HOST = 'https://analytics.example.test';
	mocks.env.PUBLIC_POSTHOG_ENABLE_DEV = 'true';
	mocks.init.mockReturnValue({ capture: mocks.capture });
	values = new Map();
	vi.stubGlobal('window', {
		addEventListener: vi.fn(),
		location: { pathname: '/degree-planner/app/plan' }
	});
	vi.stubGlobal('navigator', {});
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => values.get(key),
		setItem: (key: string, value: string) => values.set(key, value)
	});
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('analytics privacy boundary', () => {
	it.each([
		['/', 'landing'],
		['/degree-planner/', 'landing'],
		['/en', 'landing'],
		['/app/plan/', 'plan'],
		['/degree-planner/app/catalog', 'catalog'],
		['/app/settings', 'settings'],
		['/app/semester', 'semester'],
		['/share/SECRET_YEAR/SECRET_FACULTY/SECRET_DEGREE', 'share'],
		['/app/preview/SECRET_YEAR/SECRET_FACULTY/SECRET_DEGREE', 'share'],
		['/app/course/SECRET_COURSE', 'course'],
		['/app/search', 'search'],
		['/app/offline', 'offline'],
		['/app/', undefined],
		['/something', undefined]
	])('classifies %s without private route details', (path, page) => {
		expect(analyticsPage(path)).toBe(page);
	});
	it('strips arbitrary SDK, URL, identity, plan, grade, referrer and person fields', () => {
		const id = '019ab123-0000-7000-8000-000000000001';
		const result = sanitizeAnalyticsEvent({
			event: '$pageview',
			uuid: id,
			$set: { email: 'SECRET_EMAIL' },
			$set_once: { $initial_current_url: 'SECRET_URL' },
			properties: {
				token: 'phc_test_only',
				distinct_id: id,
				$session_id: id,
				page: 'share',
				$device_id: 'SECRET_FIREBASE_ID',
				$current_url: 'SECRET_QUERY',
				$referrer: 'SECRET_REFERRER',
				grades: [99],
				filename: 'SECRET_FILE',
				semester: 'SECRET_COURSE',
				$set: { name: 'SECRET_NAME' },
				$set_once: { $initial_current_url: 'SECRET_URL' },
				source: 'SECRET_SOURCE',
				$process_person_profile: true
			}
		});
		expect(result?.properties).toEqual({
			auth_status: 'unknown',
			token: 'phc_test_only',
			distinct_id: id,
			$session_id: id,
			$process_person_profile: false,
			$geoip_disable: true,
			page: 'share',
			$pathname: '/degree-planner/share'
		});
		expect(JSON.stringify(result)).not.toContain('SECRET');
		expect(result).not.toHaveProperty('$set');
		expect(result).not.toHaveProperty('$set_once');
	});
	it('drops unknown auto events, raw account IDs and invalid pages', () => {
		for (const event of [
			'$identify',
			'$snapshot',
			'$exception',
			'$autocapture'
		])
			expect(
				sanitizeAnalyticsEvent({ uuid: 'test', event, properties: {} })
			).toBeNull();
		expect(
			sanitizeAnalyticsEvent({
				uuid: 'test',
				event: 'start_clicked',
				properties: { distinct_id: 'firebase-user' }
			})
		).toBeNull();
		expect(
			sanitizeAnalyticsEvent({
				uuid: 'test',
				event: '$pageview',
				properties: {
					distinct_id: '019ab123-0000-7000-8000-000000000001',
					page: 'SECRET'
				}
			})
		).toBeNull();
	});
	it.each(['courses_shuffled', 'plan_updated'])(
		'allows %s without exposing course, semester, plan or account data',
		(event) => {
			for (const auth_status of ['signed_in', 'signed_out', 'unknown']) {
				const result = sanitizeAnalyticsEvent({
					uuid: 'test',
					event,
					properties: {
						distinct_id: '019ab123-0000-7000-8000-000000000001',
						page: 'plan',
						source: 'plan_board',
						auth_status,
						course: 'SECRET_COURSE',
						from_semester: 'SECRET_SOURCE',
						to_semester: 'SECRET_TARGET',
						plan: 'SECRET_PLAN',
						uid: 'SECRET_ACCOUNT'
					}
				});
				expect(result?.event).toBe(event);
				expect(result?.properties.auth_status).toBe(auth_status);
				expect(result?.properties.source).toBe(
					event === 'courses_shuffled' ? 'plan_board' : undefined
				);
				expect(JSON.stringify(result)).not.toContain('SECRET');
			}
		}
	);
	it('never enables optional or remotely configured capture', () => {
		expect(privacyConfig).toMatchObject({
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
			respect_dnt: true
		});
	});
});

describe('saved course moves', () => {
	const before = {
		wishlist: ['02340124'],
		semesters: [['01040184', '03240033'], ['02340141'], []],
		exemptions: [],
		currentSemester: 0
	} as UserData;
	it.each([
		['unchanged', before.semesters],
		['same-semester reorder', [['03240033', '01040184'], ['02340141'], []]],
		[
			'initial placement',
			[['01040184', '03240033'], ['02340141', '02340124'], []]
		],
		['removal or move to wishlist', [['01040184'], ['02340141'], []]],
		[
			'copy without removal',
			[['01040184', '03240033'], ['02340141', '01040184'], []]
		]
	])('does not count %s as a shuffle', async (_, semesters) => {
		const { trackCourseMoves } = await import('./analytics');
		trackCourseMoves(before, { ...before, semesters } as UserData);
		expect(mocks.capture).not.toHaveBeenCalled();
	});
	it('does not count duplicate cleanup as a move', async () => {
		const { trackCourseMoves } = await import('./analytics');
		trackCourseMoves(
			{
				...before,
				semesters: [
					['01040184', '01040184', '03240033'],
					['02340141', '01040184'],
					[]
				]
			},
			before
		);
		expect(mocks.capture).not.toHaveBeenCalled();
	});
	it('counts each moved course once, including multiple courses saved together', async () => {
		const { trackCourseMoves } = await import('./analytics');
		trackCourseMoves(before, {
			...before,
			semesters: [[], ['02340141', '01040184', '01040184'], ['03240033']]
		});
		expect(mocks.capture).toHaveBeenCalledTimes(2);
		for (const call of mocks.capture.mock.calls) {
			expect(call[0]).toBe('courses_shuffled');
			expect(call[1]).toEqual({
				page: 'plan',
				source: 'plan_board',
				auth_status: 'unknown'
			});
		}
	});
});

describe('analytics lifecycle', () => {
	it('deduplicates hydration, aliases and query-only page updates, but counts return visits', async () => {
		const { trackPageView } = await import('./analytics');
		for (const path of [
			'/',
			'/en',
			'/',
			'/app/catalog',
			'/app/catalog',
			'/app/course/02340124',
			'/app/catalog',
			'/unknown',
			'/app/catalog'
		])
			trackPageView(path);
		vi.runAllTimers();
		expect(mocks.init).toHaveBeenCalledOnce();
		expect(mocks.capture.mock.calls.map((args) => args[1].page)).toEqual([
			'landing',
			'catalog',
			'course',
			'catalog',
			'catalog'
		]);
	});
	it.each(['key', 'host', 'invalidHost', 'dev', 'ssr', 'dnt', 'gpc'])(
		'is a no-op for %s',
		async (condition) => {
			if (condition === 'key') mocks.env.PUBLIC_POSTHOG_KEY = '';
			if (condition === 'host') mocks.env.PUBLIC_POSTHOG_HOST = '';
			if (condition === 'invalidHost')
				mocks.env.PUBLIC_POSTHOG_HOST = 'http://unsafe.test';
			if (condition === 'dev') mocks.env.PUBLIC_POSTHOG_ENABLE_DEV = 'false';
			if (condition === 'ssr') mocks.runtime.browser = false;
			if (condition === 'dnt') vi.stubGlobal('navigator', { doNotTrack: '1' });
			if (condition === 'gpc')
				vi.stubGlobal('navigator', { globalPrivacyControl: true });
			const { trackPageView, trackEvent } = await import('./analytics');
			trackPageView('/');
			trackEvent('start_clicked');
			expect(mocks.init).not.toHaveBeenCalled();
			expect(mocks.capture).not.toHaveBeenCalled();
		}
	);
	it('does not break an action if init or capture throws', async () => {
		mocks.init.mockImplementationOnce(() => {
			throw Error('blocked');
		});
		let analytics = await import('./analytics');
		expect(() => analytics.trackEvent('start_clicked')).not.toThrow();
		vi.resetModules();
		mocks.capture.mockImplementationOnce(() => {
			throw Error('blocked');
		});
		analytics = await import('./analytics');
		expect(() => analytics.trackEvent('start_clicked')).not.toThrow();
	});
	it('does not initialize or store identifiers on Storybook routes', async () => {
		vi.stubGlobal('window', {
			location: { pathname: '/degree-planner/storybook/iframe.html' }
		});
		const { trackEvent, trackFirstDegreeSelection } =
			await import('./analytics');
		trackEvent('start_clicked');
		trackFirstDegreeSelection(false);
		expect(mocks.init).not.toHaveBeenCalled();
		expect(values.size).toBe(0);
	});
	it('persists only an anonymous ID and keeps it across document loads', async () => {
		let analytics = await import('./analytics');
		analytics.trackPageView('/');
		const id = mocks.init.mock.calls[0][1].bootstrap.distinctID;
		expect([...values.values()]).toEqual([id]);
		vi.resetModules();
		analytics = await import('./analytics');
		analytics.trackPageView('/');
		expect(mocks.init.mock.calls[1][1].bootstrap.distinctID).toBe(id);
		expect(mocks.init.mock.calls[1][1]).toMatchObject({
			persistence: 'memory',
			disable_persistence: true
		});
	});
	it('counts first degree once across reloads and never counts an existing degree', async () => {
		let analytics = await import('./analytics');
		analytics.trackFirstDegreeSelection(false);
		analytics.trackFirstDegreeSelection(false);
		vi.resetModules();
		analytics = await import('./analytics');
		analytics.trackFirstDegreeSelection(false);
		expect(mocks.capture).toHaveBeenCalledOnce();
		values.clear();
		vi.resetModules();
		mocks.capture.mockClear();
		analytics = await import('./analytics');
		analytics.trackFirstDegreeSelection(true);
		analytics.trackFirstDegreeSelection(false);
		expect(mocks.capture).not.toHaveBeenCalled();
	});
	it('uses memory fallback when storage is denied', async () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw Error('denied');
			},
			setItem: () => {
				throw Error('denied');
			}
		});
		const { trackFirstDegreeSelection } = await import('./analytics');
		trackFirstDegreeSelection(false);
		trackFirstDegreeSelection(false);
		expect(mocks.capture).toHaveBeenCalledOnce();
	});
	it('counts additions once per new placement without sending course or semester IDs', async () => {
		const { trackCourseAdditions } = await import('./analytics');
		const before = {
			wishlist: ['02340124', '02340141'],
			semesters: [['01040184', '03240033'], []],
			exemptions: [],
			currentSemester: 0
		} as UserData;
		trackCourseAdditions(
			before,
			{
				...before,
				wishlist: [...before.wishlist].reverse(),
				semesters: [[...before.semesters[0]].reverse(), []]
			},
			'plan_board'
		);
		expect(mocks.capture).not.toHaveBeenCalled();
		trackCourseAdditions(
			before,
			{
				...before,
				wishlist: ['02340124', '01040184', '01040184'],
				semesters: [['01040184'], ['03240033', '02340141', '02340141']]
			},
			'plan_board'
		);
		expect(mocks.capture.mock.calls.map((args) => args[0])).toEqual([
			'course_added_to_wishlist',
			'course_added_to_semester',
			'course_added_to_semester'
		]);
		expect(
			mocks.capture.mock.calls.every(
				(args) =>
					JSON.stringify(args[1]) ===
					JSON.stringify({
						page: 'plan',
						source: 'plan_board',
						auth_status: 'unknown'
					})
			)
		).toBe(true);
	});
});

describe('authentication segmentation', () => {
	async function setup() {
		const analytics = await import('./analytics');
		const { observeAnalyticsAuth } = await import('./analyticsAuth');
		let resolve!: (user: object | null) => void;
		let fail!: (error: unknown) => void;
		const auth = {
			onAuthStateChanged: vi.fn((next, error) => {
				resolve = next;
				fail = error;
				return () => {};
			})
		};
		observeAnalyticsAuth(auth);
		observeAnalyticsAuth(auth);
		expect(auth.onAuthStateChanged).toHaveBeenCalledOnce();
		return { ...analytics, resolve, fail };
	}
	it('waits briefly for resolved auth on app entry without losing visit time', async () => {
		const { trackPageView, resolve } = await setup();
		const entered = new Date();
		trackPageView('/app/plan');
		expect(mocks.capture).not.toHaveBeenCalled();
		vi.advanceTimersByTime(100);
		resolve({ uid: 'SECRET_ID', email: 'SECRET_EMAIL' });
		expect(mocks.capture).toHaveBeenCalledWith(
			'$pageview',
			{ page: 'plan', auth_status: 'signed_in' },
			expect.objectContaining({ timestamp: entered })
		);
		vi.runAllTimers();
		expect(mocks.capture).toHaveBeenCalledOnce();
		expect(JSON.stringify(mocks.capture.mock.calls)).not.toContain('SECRET');
	});
	it('uses unknown for unresolved, failed, and lazy landing auth, and updates login/logout', async () => {
		const { trackPageView, trackEvent, resolve, fail } = await setup();
		trackPageView('/');
		trackEvent('start_clicked');
		resolve(null);
		trackEvent('start_clicked');
		resolve({ uid: 'SECRET' });
		trackEvent('start_clicked');
		resolve(null);
		trackEvent('start_clicked');
		fail(new Error('unavailable'));
		trackEvent('start_clicked');
		expect(mocks.capture.mock.calls.map((call) => call[1].auth_status)).toEqual(
			['unknown', 'unknown', 'signed_out', 'signed_in', 'signed_out', 'unknown']
		);
	});
	it('contains observer registration failures and keeps auth unknown', async () => {
		const { observeAnalyticsAuth, analyticsAuthStatus } =
			await import('./analyticsAuth');
		expect(() =>
			observeAnalyticsAuth({
				onAuthStateChanged() {
					throw new Error('unavailable');
				}
			})
		).not.toThrow();
		expect(analyticsAuthStatus()).toBe('unknown');
	});
	it('flushes a short visit on pagehide before the auth timeout', async () => {
		const { trackPageView } = await setup();
		trackPageView('/app/plan');
		const callback = vi
			.mocked(window.addEventListener)
			.mock.calls.find(([event]) => event === 'pagehide')?.[1] as () => void;
		callback();
		vi.runAllTimers();
		expect(mocks.capture).toHaveBeenCalledOnce();
		expect(mocks.capture.mock.calls[0][1]).toEqual({
			page: 'plan',
			auth_status: 'unknown'
		});
	});
	it('times out unresolved pageviews once and never retroactively relabels them', async () => {
		const { trackPageView, resolve } = await setup();
		trackPageView('/app/plan');
		vi.advanceTimersByTime(1000);
		expect(mocks.capture).toHaveBeenCalledWith(
			'$pageview',
			{ page: 'plan', auth_status: 'unknown' },
			expect.any(Object)
		);
		resolve(null);
		trackPageView('/app/plan');
		expect(mocks.capture).toHaveBeenCalledOnce();
	});
	it('flushes departed pages and preserves page-before-action order', async () => {
		const { trackPageView, trackEvent, resolve } = await setup();
		trackPageView('/app/plan');
		trackPageView('/app/catalog');
		trackEvent('start_clicked');
		resolve({});
		vi.runAllTimers();
		expect(
			mocks.capture.mock.calls.map((call) => [
				call[0],
				call[1].page,
				call[1].auth_status
			])
		).toEqual([
			['$pageview', 'plan', 'unknown'],
			['$pageview', 'catalog', 'unknown'],
			['start_clicked', 'plan', 'unknown']
		]);
	});
	it.each(['signed_in', 'signed_out', 'unknown', 'SECRET_EMAIL', null, {}])(
		'allowlists auth status %j',
		(status) => {
			const result = sanitizeAnalyticsEvent({
				event: 'start_clicked',
				uuid: 'test',
				properties: {
					distinct_id: '019ab123-0000-7000-8000-000000000001',
					auth_status: status,
					uid: 'SECRET_ID'
				}
			});
			expect(result?.properties.auth_status).toBe(
				['signed_in', 'signed_out', 'unknown'].includes(status as string)
					? status
					: 'unknown'
			);
			expect(JSON.stringify(result)).not.toContain('SECRET');
		}
	);
});

it('does not initialize PostHog or write identifiers in staging with live-looking keys', async () => {
	mocks.env.PUBLIC_DEPLOYMENT_ENV = 'staging';
	const analytics = await import('./analytics');
	analytics.trackPageView('/degree-planner/app/plan');
	analytics.trackEvent('start_clicked');
	analytics.trackFirstDegreeSelection(false);
	expect(mocks.init).not.toHaveBeenCalled();
	expect(mocks.capture).not.toHaveBeenCalled();
	expect(values.size).toBe(0);
});
