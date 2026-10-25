/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';
import { isAppNavigation, isImmutableAppAsset } from './lib/pwa/cache-policy';
import { activateIfSoleClient } from './lib/pwa/update-activation';
import { ShellPreparationError } from './lib/pwa/shell-failure';
import { withShellFetchDeadline } from './lib/pwa/shell-fetch';

const worker = self as unknown as ServiceWorkerGlobalScope;
const SHELL_PREFIX = 'planit-console-shell-';
const SHELL_CACHE = `${SHELL_PREFIX}${version}`;
const SHELL = '/app/offline';
// Landing demo screenshots are not required by the console.
const ASSETS = new Set(
	[...build, ...files].filter(
		(path) =>
			!/\/(?:catalog|course|plan|semester|settings|share|search)-pic\./.test(
				path
			)
	)
);

const SHELL_RESOURCES = [...new Set([...ASSETS, SHELL])];
const SHELL_ENTRIES = build.filter((path) =>
	/\/entry\/(?:start|app)\.[^/]+\.js$/.test(path)
);
let preparation: Promise<void> | undefined;

/** A successful install is not enough after browser storage has been evicted. */
function prepareShell(): Promise<void> {
	preparation ??= (async () => {
		const cache = await caches.open(SHELL_CACHE);
		const cached = new Set((await cache.keys()).map((request) => request.url));
		const missing = SHELL_RESOURCES.filter(
			(path) => !cached.has(new URL(path, worker.location.origin).href)
		);
		// Fetch only this build's public shell. Never cache navigation responses,
		// auth requests, or public JSON (which belongs to IndexedDB).
		const fetched = await Promise.all(
			missing.map((path) =>
				withShellFetchDeadline(async (signal) => {
					const request = new Request(new URL(path, worker.location.origin), {
						credentials: 'omit',
						redirect: 'error',
						cache: 'reload'
					});
					const response = await fetch(request, { signal });
					if (
						!response.ok ||
						response.redirected ||
						/\b(?:private|no-store)\b/i.test(
							response.headers.get('cache-control') ?? ''
						)
					)
						throw new ShellPreparationError('download');
					if (
						path !== SHELL &&
						/text\/html/i.test(response.headers.get('content-type') ?? '')
					)
						throw new ShellPreparationError('download');
					// Include the response body in the deadline. Headers alone do not
					// mean the download finished, particularly on mobile reconnect.
					const body = await response.arrayBuffer();
					if (path === SHELL) {
						const html = await new Response(body).text();
						// An old active worker may be repairing after a newer deployment.
						// Never combine that deployment's HTML with the old build's scripts.
						if (
							!response.headers.get('content-type')?.includes('text/html') ||
							SHELL_ENTRIES.length < 2 ||
							!SHELL_ENTRIES.every(
								(entry) =>
									html.includes(JSON.stringify(entry)) ||
									html.includes(`'${entry}'`)
							)
						)
							throw new ShellPreparationError('build-changed');
					}
					return {
						request,
						response: new Response(body, {
							status: response.status,
							statusText: response.statusText,
							headers: response.headers
						})
					};
				})
			)
		);
		await Promise.all(
			fetched.map(({ request, response }) => cache.put(request, response))
		);

		const stored = new Set((await cache.keys()).map((request) => request.url));
		if (
			SHELL_RESOURCES.some(
				(path) => !stored.has(new URL(path, worker.location.origin).href)
			)
		)
			throw new ShellPreparationError('verification');
	})()
		.catch((error) => {
			// Cache API failures include unavailable storage and quota limits. Keep
			// only a bounded reason code, not a native English exception or URL.
			throw error instanceof ShellPreparationError
				? error
				: new ShellPreparationError('storage');
		})
		.finally(() => {
			preparation = undefined;
		});
	return preparation;
}

worker.addEventListener('install', (event) => {
	// An old registration automatically checks this same script URL. Keep its
	// previous offline start route intact until the page verifies /app/ and
	// explicitly installs the redirect-only compatibility worker at root.
	if (worker.registration?.scope === `${worker.location.origin}/`) {
		event.waitUntil(
			Promise.reject(
				new Error('Legacy root scope requires the verified console transition')
			)
		);
		return;
	}
	event.waitUntil(prepareShell());
	// Activation requires a version-bound, explicit request from a sole app client.
});

worker.addEventListener('message', (event) => {
	const port = event.ports?.[0];
	if (!port) return;
	if (event.data?.type === 'ACCEPT_UPDATE') {
		event.waitUntil(
			(async () => {
				let status;
				try {
					const source =
						event.source && 'id' in event.source && 'url' in event.source
							? { id: event.source.id, url: event.source.url }
							: undefined;
					status = await activateIfSoleClient(event.data.version, source, {
						origin: worker.location.origin,
						version,
						clients: () =>
							worker.clients.matchAll({
								type: 'window',
								includeUncontrolled: true
							}),
						prepare: prepareShell,
						activate: () => worker.skipWaiting()
					});
				} catch {
					status = 'failed';
				}
				port.postMessage({ type: 'UPDATE_ACTIVATION', version, status });
			})()
		);
		return;
	}
	if (event.data?.type === 'GET_OFFLINE_SHELL_VERSION') {
		port.postMessage({ type: 'OFFLINE_SHELL_VERSION', version });
		return;
	}
	if (event.data?.type !== 'PREPARE_OFFLINE_SHELL') return;
	event.waitUntil(
		(async () => {
			// A newer online page can run behind an older controlling worker while
			// its update waits. That worker cannot serve the page's lazy route chunks.
			if (event.data.version !== version) {
				port.postMessage({
					type: 'OFFLINE_SHELL_STATUS',
					status: 'outdated',
					version
				});
				return;
			}
			try {
				await prepareShell();
				port.postMessage({
					type: 'OFFLINE_SHELL_STATUS',
					status: 'ready',
					version
				});
			} catch (error) {
				port.postMessage({
					type: 'OFFLINE_SHELL_STATUS',
					status: 'unavailable',
					reason:
						error instanceof ShellPreparationError
							? error.reason
							: 'verification',
					version
				});
			}
		})()
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// A window can open after the acceptance client check. Never delete old
			// caches on activation: those documents may still import old lazy chunks.
			// Cache GC requires a separate, conservative live-client/version protocol.
			await worker.clients.claim();
		})()
	);
});

worker.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (
		request.method !== 'GET' ||
		url.origin !== worker.location.origin ||
		request.headers.has('authorization') ||
		request.headers.has('range')
	)
		return;

	if (request.mode === 'navigate' && isAppNavigation(url.pathname)) {
		event.respondWith(
			fetch(request).catch(
				async () =>
					(await caches.match(SHELL, { cacheName: SHELL_CACHE })) ??
					Response.error()
			)
		);
	} else if (
		(ASSETS.has(url.pathname) || isImmutableAppAsset(url.pathname)) &&
		!url.search
	) {
		event.respondWith(
			(async () => {
				const current = await caches.match(request, { cacheName: SHELL_CACHE });
				if (current) return current;
				if (isImmutableAppAsset(url.pathname)) {
					for (const name of await caches.keys()) {
						if (!name.startsWith(SHELL_PREFIX) || name === SHELL_CACHE)
							continue;
						const retained = await caches.match(request, { cacheName: name });
						if (retained) return retained;
					}
				}
				return fetch(request);
			})()
		);
	}
	// Public JSON belongs exclusively to the IndexedDB repository.
});
