// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: true, dev: false }));
vi.mock('$env/static/public', () => ({
	PUBLIC_POSTHOG_KEY: 'phc_test_only',
	PUBLIC_POSTHOG_HOST: 'https://posthog.example.test'
}));

it('initializes the application wrapper against the real SDK', async () => {
	history.replaceState(null, '', '/');
	const beacons: unknown[] = [];
	Object.defineProperty(navigator, 'sendBeacon', {
		configurable: true,
		value: (...args: unknown[]) => {
			beacons.push(args);
			return true;
		}
	});
	vi.stubGlobal('fetch', vi.fn());
	const { trackPageView, trackEvent } = await import('./analytics');
	trackPageView('/');
	trackEvent('start_clicked');
	expect(localStorage.getItem('planit.analytics.browser-id.v1')).toMatch(
		/^[0-9a-f-]{36}$/
	);
	await vi.waitFor(() => expect(beacons).toHaveLength(2));
	vi.unstubAllGlobals();
});
