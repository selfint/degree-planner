// @vitest-environment jsdom
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anonymousId, privacyConfig } from './analyticsPolicy';

// Exercise the actual bundled SDK, not a mocked capture/init API.
describe('real PostHog SDK privacy boundary', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		localStorage.clear();
		sessionStorage.clear();
	});
	it('emits only the allowed envelope and never persists private route attribution', async () => {
		history.replaceState(
			null,
			'',
			'/share/PRIVATE_YEAR/PRIVATE_FACULTY/PRIVATE_DEGREE?semesters=PRIVATE_COURSES#PRIVATE_HASH'
		);
		vi.spyOn(document, 'referrer', 'get').mockReturnValue(
			'https://referrer.test/PRIVATE_REFERRER'
		);
		const beacons: { url: string; data: unknown }[] = [];
		Object.defineProperty(navigator, 'sendBeacon', {
			configurable: true,
			value: (url: string, data: unknown) => {
				beacons.push({ url, data });
				return true;
			}
		});
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		const { default: posthog } =
			await import('posthog-js/dist/module.slim.no-external.js');
		const id = '019ab123-0000-7000-8000-000000000001';
		const client = posthog.init(
			'phc_test_only',
			{
				...privacyConfig,
				api_host: 'https://posthog.example.test',
				bootstrap: { distinctID: id, isIdentifiedID: false }
			},
			'privacyTest'
		)!;
		const result = client.capture(
			'$pageview',
			{
				page: 'share',
				filename: 'PRIVATE_FILE',
				$set: { name: 'PRIVATE_NAME' }
			},
			{ transport: 'sendBeacon', send_instantly: true }
		);
		expect(result).toBeDefined();
		expect(result?.properties).toMatchObject({
			page: 'share',
			distinct_id: id,
			token: 'phc_test_only',
			$process_person_profile: false,
			$geoip_disable: true
		});
		expect(result?.properties.$session_id).toMatch(anonymousId);
		expect(JSON.stringify(result)).not.toContain('PRIVATE');
		expect(
			JSON.stringify({
				local: { ...localStorage },
				session: { ...sessionStorage },
				cookies: document.cookie
			})
		).not.toContain('PRIVATE');
		expect(localStorage.length).toBe(0);
		expect(sessionStorage.length).toBe(0);
		client.capture(
			'$autocapture',
			{ secret: 'PRIVATE' },
			{ transport: 'sendBeacon', send_instantly: true }
		);
		await vi.waitFor(() => expect(beacons).toHaveLength(1));
		expect(beacons[0].url).toContain('https://posthog.example.test/e/');
		const data = beacons[0].data;
		const bytes =
			typeof data === 'string'
				? Buffer.from(data)
				: Buffer.from(
						await new Promise<ArrayBuffer>((resolve) => {
							const reader = new FileReader();
							reader.onload = () => resolve(reader.result as ArrayBuffer);
							reader.readAsArrayBuffer(data as Blob);
						})
					);
		const body = (
			bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes
		).toString();
		// No remote flags, replay, surveys or config requests bypass this boundary.
		expect(fetch).not.toHaveBeenCalled();
		const encoded = new URLSearchParams(body).get('data');
		const payload = encoded ? JSON.parse(atob(encoded)) : JSON.parse(body);
		expect(payload.batch).toHaveLength(1);
		expect(payload.batch[0].properties).toMatchObject({
			page: 'share',
			distinct_id: id
		});
		expect(JSON.stringify(payload)).not.toContain('PRIVATE');
		client.opt_out_capturing();
	});
	it('counts memory-only sessions across events and rotates after inactivity or a new document', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const started = new Date('2026-11-06T12:00:00Z').getTime();
		vi.setSystemTime(started);
		Object.defineProperty(navigator, 'sendBeacon', {
			configurable: true,
			value: () => true
		});
		vi.stubGlobal('fetch', vi.fn());
		const { default: posthog } =
			await import('posthog-js/dist/module.slim.no-external.js');
		const config = {
			...privacyConfig,
			api_host: 'https://posthog.example.test',
			bootstrap: {
				distinctID: '019ab123-0000-7000-8000-000000000002',
				isIdentifiedID: false
			}
		};
		const client = posthog.init('phc_test_only', config, 'sessionTest')!;
		const capture = (event: '$pageview' | 'start_clicked' = '$pageview') =>
			client.capture(
				event,
				{ page: 'plan' },
				{ transport: 'sendBeacon', send_instantly: true }
			)?.properties.$session_id;
		const first = capture();
		expect(first).toMatch(anonymousId);
		vi.setSystemTime(started + 29 * 60_000);
		expect(capture('start_clicked')).toBe(first);
		vi.setSystemTime(started + 58 * 60_000);
		expect(capture()).toBe(first);
		// Inactivity is measured from the last captured event, not the first.
		vi.setSystemTime(started + 89 * 60_000);
		const next = capture();
		expect(next).toMatch(anonymousId);
		expect(next).not.toBe(first);

		// A fresh SDK instance models a new document with the same browser UUID.
		const reloaded = posthog.init(
			'phc_test_only',
			config,
			'sessionReloadTest'
		)!;
		const reloadedEvent = reloaded.capture(
			'$pageview',
			{ page: 'plan' },
			{ transport: 'sendBeacon', send_instantly: true }
		);
		expect(reloadedEvent?.properties.distinct_id).toBe(
			config.bootstrap.distinctID
		);
		expect(reloadedEvent?.properties.$session_id).toMatch(anonymousId);
		expect(reloadedEvent?.properties.$session_id).not.toBe(next);
		expect(localStorage.length).toBe(0);
		expect(sessionStorage.length).toBe(0);
		client.opt_out_capturing();
		reloaded.opt_out_capturing();
	});
});
