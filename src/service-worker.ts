/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';
import { isAppNavigation } from './lib/pwa/cache-policy';

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
			missing.map(async (path) => {
				const request = new Request(new URL(path, worker.location.origin), {
					credentials: 'omit',
					redirect: 'error',
					cache: 'reload'
				});
				const response = await fetch(request);
				if (
					!response.ok ||
					response.redirected ||
					/\b(?:private|no-store)\b/i.test(
						response.headers.get('cache-control') ?? ''
					)
				)
					throw new Error('App asset is unavailable for offline storage');
				if (
					path !== SHELL &&
					/text\/html/i.test(response.headers.get('content-type') ?? '')
				)
					throw new Error('An app asset returned an HTML fallback');
				if (path === SHELL) {
					const html = await response.clone().text();
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
						throw new Error('Offline shell belongs to another app build');
				}
				return { request, response };
			})
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
			throw new Error('Offline app assets are incomplete');
	})().finally(() => {
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
	// Do not skipWaiting: another tab may contain unsaved work or pending writes.
});

worker.addEventListener('message', (event) => {
	const port = event.ports?.[0];
	if (event.data?.type !== 'PREPARE_OFFLINE_SHELL' || !port) return;
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
			} catch {
				port.postMessage({
					type: 'OFFLINE_SHELL_STATUS',
					status: 'unavailable',
					version
				});
			}
		})()
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => key.startsWith(SHELL_PREFIX) && key !== SHELL_CACHE)
					.map((key) => caches.delete(key))
			);
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
	} else if (ASSETS.has(url.pathname) && !url.search) {
		event.respondWith(
			(async () =>
				(await caches.match(request, { cacheName: SHELL_CACHE })) ??
				fetch(request))()
		);
	}
	// Public JSON belongs exclusively to the IndexedDB repository.
});
