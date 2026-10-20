type ClientIdentity = { id: string; url: string };
export type ActivationStatus = 'accepted' | 'other-tabs' | 'invalid' | 'failed';

/** Conservatively refuse all other app documents, including older/unknown clients.
 * This is NOT a lock against newly opening windows. Activation must also preserve
 * old immutable assets and must never reload a client that did not accept. */
export async function activateIfSoleClient(
	requestedVersion: unknown,
	source: ClientIdentity | undefined,
	dependencies: {
		origin: string;
		version: string;
		clients: () => Promise<ClientIdentity[]>;
		prepare: () => Promise<void>;
		activate: () => Promise<void>;
	}
): Promise<ActivationStatus> {
	const isApp = (client: ClientIdentity) => {
		const url = new URL(client.url);
		return (
			url.origin === dependencies.origin &&
			(url.pathname === '/app' || url.pathname.startsWith('/app/'))
		);
	};
	if (requestedVersion !== dependencies.version || !source || !isApp(source))
		return 'invalid';
	const inspect = async () => {
		const clients = (await dependencies.clients()).filter(isApp);
		if (!clients.some((client) => client.id === source.id)) return 'invalid';
		return clients.some((client) => client.id !== source.id)
			? 'other-tabs'
			: 'accepted';
	};
	const before = await inspect();
	if (before !== 'accepted') return before;
	await dependencies.prepare();
	const after = await inspect();
	if (after !== 'accepted') return after;
	await dependencies.activate();
	return 'accepted';
}

export function requestUpdateActivation(
	worker: Pick<ServiceWorker, 'postMessage'>,
	version: string,
	timeoutMs = 15000
): Promise<ActivationStatus> {
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		const finish = (status?: ActivationStatus, error?: Error) => {
			clearTimeout(timer);
			channel.port1.close();
			channel.port2.close();
			if (status) resolve(status);
			else reject(error);
		};
		const timer = setTimeout(
			() => finish(undefined, new Error('Update activation timed out.')),
			timeoutMs
		);
		channel.port1.onmessage = ({ data }) => {
			if (
				data?.type !== 'UPDATE_ACTIVATION' ||
				data.version !== version ||
				!['accepted', 'other-tabs', 'invalid', 'failed'].includes(data.status)
			) {
				finish(undefined, new Error('Invalid update activation response.'));
				return;
			}
			finish(data.status);
		};
		channel.port1.onmessageerror = () =>
			finish(
				undefined,
				new Error('Update activation response could not be read.')
			);
		try {
			worker.postMessage({ type: 'ACCEPT_UPDATE', version }, [channel.port2]);
		} catch (error) {
			finish(
				undefined,
				error instanceof Error ? error : new Error(String(error))
			);
		}
	});
}

/** No global controllerchange reload listener: only the accepting operation waits. */
export function waitForUpdateController(
	container: ServiceWorkerContainer,
	expected: ServiceWorker,
	timeoutMs = 15000
): { promise: Promise<void>; dispose: () => void } {
	let dispose = () => {};
	const promise = new Promise<void>((resolve, reject) => {
		const changed = () => {
			if (container.controller === expected) {
				dispose();
				resolve();
			}
		};
		const timer = setTimeout(() => {
			dispose();
			reject(new Error('Updated worker did not take control.'));
		}, timeoutMs);
		dispose = () => {
			clearTimeout(timer);
			container.removeEventListener('controllerchange', changed);
		};
		container.addEventListener('controllerchange', changed);
		changed();
	});
	// The activation request may reject before this promise is awaited.
	void promise.catch(() => {});
	return { promise, dispose: () => dispose() };
}
