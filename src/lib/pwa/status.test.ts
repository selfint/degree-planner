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
});
