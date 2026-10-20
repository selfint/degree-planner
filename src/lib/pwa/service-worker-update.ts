/** Capture before installation finishes: clients.claim() can precede the
 * installed event in WebKit, so a controller at that later point is not proof
 * that this was an update. The installing worker itself is never an old build. */
export function replacesExistingWorker(
	installing: object,
	active: object | null,
	controller: object | null
): boolean {
	return (
		(active !== null && active !== installing) ||
		(controller !== null && controller !== installing)
	);
}

/** Read the registration's current workers, not the worker that emitted an old
 * event: a superseded waiting worker must not hide a newer available update. */
export function hasWaitingUpdate(
	waiting: Pick<ServiceWorker, 'state'> | null,
	active: object | null
): boolean {
	return (
		waiting?.state === 'installed' &&
		replacesExistingWorker(waiting, active, null)
	);
}

type VersionWorker = Pick<ServiceWorker, 'postMessage'>;
type UpdateVersionState = { version?: string; error?: string };

/** Read only the contacted worker's compiled version. This never activates it. */
export function readWaitingWorkerVersion(
	worker: VersionWorker,
	timeoutMs = 10000
): Promise<string> {
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		let settled = false;
		const finish = (version?: string, error?: unknown) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			channel.port1.close();
			channel.port2.close();
			if (version !== undefined) resolve(version);
			else reject(error);
		};
		const timer = setTimeout(
			() =>
				finish(
					undefined,
					new Error('Timed out waiting for the update version.')
				),
			timeoutMs
		);
		channel.port1.onmessage = (event) => {
			const reply = event.data;
			if (
				reply?.type !== 'OFFLINE_SHELL_VERSION' ||
				typeof reply.version !== 'string' ||
				!reply.version.trim()
			) {
				finish(
					undefined,
					new Error('The waiting update returned an invalid version response.')
				);
				return;
			}
			finish(reply.version);
		};
		channel.port1.onmessageerror = () =>
			finish(
				undefined,
				new Error('The update version response could not be read.')
			);
		try {
			worker.postMessage({ type: 'GET_OFFLINE_SHELL_VERSION' }, [
				channel.port2
			]);
		} catch (error) {
			finish(undefined, error);
		}
	});
}

/** One query per waiting-worker identity, with no polling or stale replies. */
export function createUpdateVersionReader(
	getWaitingWorker: () => VersionWorker | null,
	publish: (state: UpdateVersionState) => void,
	readVersion: (
		worker: VersionWorker
	) => Promise<string> = readWaitingWorkerVersion
) {
	let requestedWorker: VersionWorker | null = null;
	let generation = 0;
	let disposed = false;
	return {
		reconcile() {
			if (disposed) return;
			const worker = getWaitingWorker();
			if (worker === requestedWorker) return;
			requestedWorker = worker;
			const requestGeneration = ++generation;
			publish({});
			if (!worker) return;
			const isCurrent = () =>
				!disposed &&
				generation === requestGeneration &&
				getWaitingWorker() === worker;
			void readVersion(worker).then(
				(version) => {
					if (isCurrent()) publish({ version });
				},
				(error) => {
					if (isCurrent()) {
						const detail =
							error instanceof Error ? error.message : String(error ?? '');
						publish({
							error:
								detail.trim() || 'The update version could not be verified.'
						});
					}
				}
			);
		},
		dispose() {
			disposed = true;
			generation++;
		}
	};
}
