import {
	hasWaitingUpdate,
	readWaitingWorkerVersion
} from './service-worker-update';

export function isAppUpdateRegistration(
	registration: ServiceWorkerRegistration,
	origin: string,
	base = ''
) {
	return (
		registration.scope === `${origin}${base}/app/` &&
		[registration.active, registration.waiting, registration.installing].every(
			(worker) =>
				!worker || worker.scriptURL === `${origin}${base}/service-worker.js`
		)
	);
}

/** One startup boundary per mounted app, never rearmed by focus/visibility.
 * Once detection times out, late results belong to the running session. */
export function createEntryUpdate({
	finished,
	failed,
	currentVersion,
	readVersion = readWaitingWorkerVersion,
	timeoutMs = 30_000
}: {
	finished: () => void;
	failed: (error: unknown) => void;
	currentVersion: string;
	readVersion?: typeof readWaitingWorkerVersion;
	timeoutMs?: number;
}) {
	let active = true;
	let started = false;
	let removeListener = () => {};
	let releaseInstallation = () => {};
	const finish = () => {
		if (!active) return;
		active = false;
		clearTimeout(timer);
		removeListener();
		releaseInstallation();
		finished();
	};
	const timer = setTimeout(() => {
		failed(new Error('Entry update check timed out.'));
		finish();
	}, timeoutMs);
	return {
		finish,
		async run(
			registration: ServiceWorkerRegistration,
			check: () => Promise<unknown>,
			activate: (worker: ServiceWorker, version: string) => Promise<unknown>
		) {
			if (!active || started) return;
			started = true;
			try {
				// A fully installed waiting worker needs no network to be applied.
				if (!hasWaitingUpdate(registration.waiting, registration.active)) {
					if ((await check()) === false)
						throw new Error('Entry update check failed.');
				}
				if (!active) return;
				const installing = registration.installing;
				if (
					installing &&
					installing.state !== 'installed' &&
					installing.state !== 'redundant'
				) {
					await new Promise<void>((resolve) => {
						releaseInstallation = resolve;
						const changed = () => {
							if (
								installing.state === 'installed' ||
								installing.state === 'redundant'
							)
								resolve();
						};
						removeListener = () =>
							installing.removeEventListener('statechange', changed);
						installing.addEventListener('statechange', changed);
						changed();
					});
					removeListener();
				}
				if (!active) return;
				const worker = registration.waiting;
				if (!worker || !hasWaitingUpdate(worker, registration.active)) return;
				const version = await readVersion(worker);
				if (
					!active ||
					registration.waiting !== worker ||
					version === currentVersion
				)
					return;
				// Activation has its own bounded acknowledgement/controller waits. Keep
				// editing gated until it settles; never release then reload a late result.
				clearTimeout(timer);
				await activate(worker, version);
			} catch (error) {
				if (active) failed(error);
			} finally {
				finish();
			}
		}
	};
}
