import { describe, expect, it, vi } from 'vitest';
import {
	prepareOfflineShell,
	prepareWithReconnectRetry,
	readShellStatus
} from './shell-readiness';

describe('worker network restoration', () => {
	it('rechecks the verified shell once after an early online failure', async () => {
		const prepare = vi
			.fn()
			.mockResolvedValueOnce('unavailable')
			.mockResolvedValue('ready');
		const wait = vi.fn().mockResolvedValue(undefined);
		expect(await prepareWithReconnectRetry(prepare, () => true, wait)).toBe(
			'ready'
		);
		expect(prepare).toHaveBeenCalledTimes(2);
		expect(wait).toHaveBeenCalledOnce();
	});
	it.each(['ready', 'outdated'] as const)(
		'does not retry %s',
		async (status) => {
			const prepare = vi.fn().mockResolvedValue(status);
			const wait = vi.fn();
			expect(await prepareWithReconnectRetry(prepare, () => true, wait)).toBe(
				status
			);
			expect(prepare).toHaveBeenCalledOnce();
			expect(wait).not.toHaveBeenCalled();
		}
	);
	it('preserves incomplete state offline without retrying', async () => {
		const prepare = vi.fn().mockResolvedValue('unavailable');
		const wait = vi.fn();
		expect(await prepareWithReconnectRetry(prepare, () => false, wait)).toBe(
			'unavailable'
		);
		expect(prepare).toHaveBeenCalledOnce();
		expect(wait).not.toHaveBeenCalled();
	});
	it('stops if the page goes offline or its controller changes during the delay', async () => {
		const prepare = vi.fn().mockResolvedValue('unavailable');
		let current = true;
		const wait = async () => {
			current = false;
		};
		expect(await prepareWithReconnectRetry(prepare, () => current, wait)).toBe(
			'unavailable'
		);
		expect(prepare).toHaveBeenCalledOnce();
	});
	it('does not loop when repair remains unavailable', async () => {
		const prepare = vi.fn().mockResolvedValue('unavailable');
		expect(
			await prepareWithReconnectRetry(
				prepare,
				() => true,
				async () => {}
			)
		).toBe('unavailable');
		expect(prepare).toHaveBeenCalledTimes(2);
	});
});

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
	it.each(['download', 'storage', 'build-changed', 'timeout'] as const)(
		'preserves a bounded worker failure reason: %s',
		async (reason) => {
			const onFailure = vi.fn();
			const controller = {
				postMessage(
					_message: unknown,
					ports?: Transferable[] | StructuredSerializeOptions
				) {
					(
						(Array.isArray(ports) ? ports : ports?.transfer)?.[0] as MessagePort
					).postMessage({
						type: 'OFFLINE_SHELL_STATUS',
						version: 'current',
						status: 'unavailable',
						reason
					});
				}
			};
			expect(
				await prepareOfflineShell(controller, 'current', 1000, onFailure)
			).toBe('unavailable');
			expect(onFailure).toHaveBeenCalledExactlyOnceWith(reason);
		}
	);
	it('uses a safe fallback for older workers and rejects unrecognized diagnostic text', async () => {
		for (const reason of [undefined, 'native English with private URL']) {
			const onFailure = vi.fn();
			await prepareOfflineShell(
				{
					postMessage(_message, ports) {
						(
							(Array.isArray(ports)
								? ports
								: ports?.transfer)?.[0] as MessagePort
						).postMessage({
							type: 'OFFLINE_SHELL_STATUS',
							version: 'current',
							status: 'unavailable',
							reason
						});
					}
				},
				'current',
				1000,
				onFailure
			);
			expect(onFailure).toHaveBeenCalledExactlyOnceWith('verification');
		}
	});
	it('does not attach a stale failure reason to ready or mismatched-build replies', async () => {
		for (const version of ['current', 'old']) {
			const onFailure = vi.fn();
			const status = await prepareOfflineShell(
				{
					postMessage(_message, ports) {
						(
							(Array.isArray(ports)
								? ports
								: ports?.transfer)?.[0] as MessagePort
						).postMessage({
							type: 'OFFLINE_SHELL_STATUS',
							version,
							status: 'ready',
							reason: 'download'
						});
					}
				},
				'current',
				1000,
				onFailure
			);
			expect(status).toBe(version === 'current' ? 'ready' : 'outdated');
			expect(onFailure).not.toHaveBeenCalled();
		}
	});
});
