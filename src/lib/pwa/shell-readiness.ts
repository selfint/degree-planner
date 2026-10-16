export type ShellReadiness = 'preparing' | 'ready' | 'outdated' | 'unavailable';

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
	timeoutMs = 30000
): Promise<ShellReadiness> {
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		const finish = (status: ShellReadiness) => {
			clearTimeout(timer);
			channel.port1.close();
			channel.port2.close();
			resolve(status);
		};
		const timer = setTimeout(() => finish('unavailable'), timeoutMs);
		channel.port1.onmessage = (event) =>
			finish(readShellStatus(event.data, expectedVersion));
		channel.port1.onmessageerror = () => finish('unavailable');
		try {
			controller.postMessage(
				{ type: 'PREPARE_OFFLINE_SHELL', version: expectedVersion },
				[channel.port2]
			);
		} catch {
			finish('unavailable');
		}
	});
}
