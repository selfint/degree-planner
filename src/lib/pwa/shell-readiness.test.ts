import { describe, expect, it } from 'vitest';
import { prepareOfflineShell, readShellStatus } from './shell-readiness';

describe('offline shell readiness', () => {
	it('requires a complete cache from the current page build', () => {
		expect(
			readShellStatus(
				{ type: 'OFFLINE_SHELL_STATUS', version: 'current', status: 'ready' },
				'current'
			)
		).toBe('ready');
	});
	it('never treats an older controlling worker as ready', () => {
		expect(
			readShellStatus(
				{ type: 'OFFLINE_SHELL_STATUS', version: 'old', status: 'ready' },
				'current'
			)
		).toBe('outdated');
	});
	it.each([
		null,
		{},
		{ status: 'ready' },
		{ type: 'OFFLINE_SHELL_STATUS', version: 'current', status: 'partial' }
	])('rejects incomplete or old-protocol replies %j', (reply) => {
		expect(readShellStatus(reply, 'current')).toBe('unavailable');
	});
	it('handles an unavailable worker without rejecting', async () => {
		expect(
			await prepareOfflineShell(
				{
					postMessage() {
						throw new Error('worker stopped');
					}
				},
				'current'
			)
		).toBe('unavailable');
	});
	it('bounds an old worker that cannot answer the handshake', async () => {
		expect(await prepareOfflineShell({ postMessage() {} }, 'current', 5)).toBe(
			'unavailable'
		);
	});
});
