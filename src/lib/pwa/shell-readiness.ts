import {
	readShellFailureReason,
	type ShellFailureReason
} from './shell-failure';

export type ShellReadiness = 'preparing' | 'ready' | 'outdated' | 'unavailable';

/** An online event can precede the worker's actual network restoration. */
export async function prepareWithReconnectRetry(
	prepare: () => Promise<ShellReadiness>,
	canRetry: () => boolean,
	wait: () => Promise<void> = () =>
		new Promise((resolve) => setTimeout(resolve, 500))
): Promise<ShellReadiness> {
	const status = await prepare();
	if (status !== 'unavailable' || !canRetry()) return status;
	await wait();
	// Retry once, and only while this page/controller is still online/current.
	return canRetry() ? prepare() : status;
}

export function readShellStatus(
	value: unknown,
	expectedVersion: string
): ShellReadiness {
	if (typeof value !== 'object' || value === null) return 'unavailable';
	const reply = value as {
		type?: unknown;
		version?: unknown;
		status?: unknown;
	};
	if (
		reply.type !== 'OFFLINE_SHELL_STATUS' ||
		typeof reply.version !== 'string'
	)
		return 'unavailable';
	if (reply.version !== expectedVersion || reply.status === 'outdated')
		return 'outdated';
	return reply.status === 'ready' ? 'ready' : 'unavailable';
}

/** Ask the controlling worker, not registration.active or a waiting update. */
export function prepareOfflineShell(
	controller: Pick<ServiceWorker, 'postMessage'>,
	expectedVersion: string,
	timeoutMs = 30000,
	onFailure?: (reason: ShellFailureReason) => void
): Promise<ShellReadiness> {
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		let finished = false;
		const finish = (status: ShellReadiness, reason?: ShellFailureReason) => {
			if (finished) return;
			finished = true;
			clearTimeout(timer);
			channel.port1.close();
			channel.port2.close();
			if (status === 'unavailable') onFailure?.(reason ?? 'verification');
			resolve(status);
		};
		const timer = setTimeout(() => finish('unavailable', 'timeout'), timeoutMs);
		channel.port1.onmessage = (event) =>
			finish(
				readShellStatus(event.data, expectedVersion),
				readShellFailureReason(event.data?.reason)
			);
		channel.port1.onmessageerror = () =>
			finish('unavailable', 'worker-unavailable');
		try {
			controller.postMessage(
				{ type: 'PREPARE_OFFLINE_SHELL', version: expectedVersion },
				[channel.port2]
			);
		} catch {
			finish('unavailable', 'worker-unavailable');
		}
	});
}
