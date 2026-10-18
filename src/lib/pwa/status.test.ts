import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { offlineShellStatus, publishOfflineShellStatus } from './status';

describe('offline shell presentation status', () => {
	beforeEach(() => {
		publishOfflineShellStatus({ status: 'ready', updateReady: false });
	});

	it('retains the actual failure while a retry is still checking', () => {
		publishOfflineShellStatus({
			status: 'unavailable',
			updateReady: false,
			error: 'The browser denied service-worker registration.'
		});
		publishOfflineShellStatus({ status: 'preparing', updateReady: false });
		expect(get(offlineShellStatus)).toEqual({
			status: 'preparing',
			updateReady: false,
			error: 'The browser denied service-worker registration.'
		});
	});

	it('clears an old failure only after verified usable shell results', () => {
		for (const status of ['ready', 'outdated'] as const) {
			publishOfflineShellStatus({
				status: 'unavailable',
				updateReady: true,
				error: 'Offline app files could not be verified.'
			});
			publishOfflineShellStatus({ status, updateReady: true });
			expect(get(offlineShellStatus)).toEqual({
				status,
				updateReady: true,
				error: undefined
			});
		}
	});

	it('reports a new failure and update state without changing the old object', () => {
		const previous = get(offlineShellStatus);
		publishOfflineShellStatus({
			status: 'unavailable',
			updateReady: true,
			error: 'Registration rejected: NotSupportedError'
		});
		expect(previous.status).toBe('ready');
		expect(get(offlineShellStatus).error).toBe(
			'Registration rejected: NotSupportedError'
		);
		expect(get(offlineShellStatus).updateReady).toBe(true);
		expect('set' in offlineShellStatus).toBe(false);
	});

	it('publishes verified update versions without retaining an older worker identity', () => {
		publishOfflineShellStatus({
			status: 'ready',
			updateReady: true,
			updateVersion: 'v2'
		});
		expect(get(offlineShellStatus).updateVersion).toBe('v2');
		publishOfflineShellStatus({ status: 'ready', updateReady: true });
		expect(get(offlineShellStatus).updateVersion).toBeUndefined();
		publishOfflineShellStatus({
			status: 'ready',
			updateReady: true,
			updateVersion: 'v3'
		});
		expect(get(offlineShellStatus).updateVersion).toBe('v3');
	});

	it('keeps version verification failures separate from a ready offline shell', () => {
		publishOfflineShellStatus({
			status: 'ready',
			updateReady: true,
			updateVersionError:
				'The waiting update returned an invalid version response.'
		});
		expect(get(offlineShellStatus).updateVersionError).toBe(
			'The waiting update returned an invalid version response.'
		);
		expect(get(offlineShellStatus).error).toBeUndefined();
		expect(get(offlineShellStatus).updateVersion).toBeUndefined();
		publishOfflineShellStatus({ status: 'ready', updateReady: false });
		expect(get(offlineShellStatus).updateVersionError).toBeUndefined();
	});
});
