/**
 * LOCAL INTEGRATION GATE: run `npm run build` first, then
 * `npx vitest run --config vitest.integration.config.ts`.
 * The local transition fixture is the untouched legacy production worker saved
 * at /tmp/degree-pwa-legacy-service-worker.js before rebuilding the prototype.
 *
 * Executes the actual production worker bundle in a fresh Node VM per test and
 * routes the real repository's fetch through its registered fetch listener.
 * IndexedDB is a new, isolated fake-indexeddb factory per test. No browser,
 * network, user cache, or persistent/private storage is touched.
 *
 * This is deterministic boundary coverage, NOT real-browser lifecycle coverage:
 * registration/update timing, multi-tab controller changes, installability,
 * browser HTTP caching, storage eviction/quota, and offline rendering still need
 * browser tests. CacheStorage below models the exact URL/GET operations used by
 * this worker; it does not implement the full browser Vary/matching algorithm.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import {
	createPublicDataRepository,
	PUBLIC_DATA_SCHEMA_VERSION
} from '../src/lib/publicData';
import {
	createIndexedDbStore,
	type CachedResource
} from '../src/lib/publicDataStore';

const origin = 'https://planit.example';
const bundlePath = resolve('.svelte-kit/output/client/service-worker.js');
// Fail loudly if no production build is present; never silently skip this gate.
const bundle = readFileSync(bundlePath, 'utf8');
const offlineHtml = readFileSync(
	resolve('.svelte-kit/output/prerendered/pages/offline.html'),
	'utf8'
);
const { version: appVersion } = JSON.parse(
	readFileSync(resolve('.svelte-kit/output/client/_app/version.json'), 'utf8')
) as { version: string };
const shellEntryPaths = [
	...new Set(
		Array.from(
			offlineHtml.matchAll(
				/\/_app\/immutable\/entry\/(?:start|app)\.[A-Za-z0-9_-]+\.js/g
			),
			(match) => match[0]
		)
	)
];
const legacyBundlePath = resolve(
	'integration/fixtures/legacy-service-worker.js'
);
const legacyBundle = readFileSync(legacyBundlePath, 'utf8');
const legacyDataCache = 'planit-public-data-v1';
const requirementUrl =
	'/_catalogs/2024_200/00002120/SC00001314_CG00006245/requirementsData.json';
const oldData = {
	name: 'requirement',
	en: 'Older requirements',
	he: 'דרישות ישנות',
	points: 120,
	nested: []
};
const newData = {
	...oldData,
	en: 'Newer requirements',
	he: 'דרישות חדשות',
	points: 130
};

function record(): CachedResource {
	return {
		key: requirementUrl,
		schemaVersion: PUBLIC_DATA_SCHEMA_VERSION,
		data: structuredClone(newData),
		validatedAt: 500,
		revision: 'newer-idb-revision',
		etag: '"newer"'
	};
}

function json(data: unknown, etag = '"older"') {
	return new Response(JSON.stringify(data), {
		headers: { 'content-type': 'application/json', etag }
	});
}

type RequestLike = Request | URL | string;
type Listener = (event: {
	request?: Request;
	data?: unknown;
	ports?: { postMessage: (message: unknown) => void }[];
	waitUntil: (promise: Promise<unknown>) => void;
	respondWith: (promise: Promise<Response> | Response) => void;
}) => void;

function shellResponse(html = offlineHtml, init: ResponseInit = {}) {
	const headers = new Headers(init.headers);
	if (!headers.has('content-type'))
		headers.set('content-type', 'text/html; charset=utf-8');
	return new Response(html, { ...init, headers });
}

async function shellNetwork(request: Request) {
	const pathname = new URL(request.url).pathname;
	return pathname === '/offline'
		? shellResponse()
		: new Response(`network:${pathname}`);
}

function requestFor(input: RequestLike, init?: RequestInit): Request {
	return new Request(
		input instanceof Request ? input : new URL(String(input), origin),
		init
	);
}

function harness(
	factory = new IDBFactory(),
	options: {
		source?: string;
		filename?: string;
		entries?: Map<string, Map<string, Response>>;
	} = {}
) {
	const entries = options.entries ?? new Map<string, Map<string, Response>>();
	const listeners = new Map<string, Listener[]>();
	const network = vi.fn<(request: Request) => Promise<Response>>(shellNetwork);
	const cacheStorage = {
		async open(name: string) {
			let values = entries.get(name);
			if (!values) entries.set(name, (values = new Map()));
			const cache = {
				async put(input: RequestLike, response: Response) {
					values!.set(requestFor(input).url, response.clone());
				},
				async match(input: RequestLike) {
					return values!.get(requestFor(input).url)?.clone();
				},
				async keys() {
					return [...values!.keys()].map((url) => new Request(url));
				},
				async delete(input: RequestLike) {
					return values!.delete(requestFor(input).url);
				},
				async addAll(inputs: RequestLike[]) {
					const fetched = await Promise.all(
						inputs.map(async (input) => {
							const request = requestFor(input);
							const response = await network(request);
							if (!response.ok) throw new TypeError('Cache.addAll failed');
							return { request, response };
						})
					);
					for (const { request, response } of fetched)
						await cache.put(request, response);
				}
			};
			return cache;
		},
		async keys() {
			return [...entries.keys()];
		},
		async delete(name: string) {
			return entries.delete(name);
		},
		async match(input: RequestLike, options?: { cacheName?: string }) {
			const key = requestFor(input).url;
			if (options?.cacheName)
				return entries.get(options.cacheName)?.get(key)?.clone();
			for (const values of entries.values()) {
				const response = values.get(key);
				if (response) return response.clone();
			}
			return undefined;
		}
	};
	const skipWaiting = vi.fn(async () => {});
	const claim = vi.fn(async () => {});
	const workerLocation = new URL('/service-worker.js', origin);
	const worker = {
		location: workerLocation,
		skipWaiting,
		clients: { claim, matchAll: vi.fn(async () => []) },
		addEventListener(type: string, listener: Listener) {
			listeners.set(type, [...(listeners.get(type) ?? []), listener]);
		}
	};
	// No source transformation or replacement policy code: this is the bundle
	// emitted by Vite, including its real generated build/files/version values.
	runInNewContext(
		options.source ?? bundle,
		{
			self: worker,
			location: workerLocation,
			caches: cacheStorage,
			indexedDB: factory,
			fetch: (input: RequestLike, init?: RequestInit) =>
				network(requestFor(input, init)),
			Request,
			Response,
			Headers,
			URL,
			AbortController,
			setTimeout,
			clearTimeout,
			console
		},
		{ filename: options.filename ?? bundlePath, timeout: 1000 }
	);

	function dispatch(type: string, properties: Record<string, unknown> = {}) {
		const pending: Promise<unknown>[] = [];
		let response: Promise<Response> | undefined;
		for (const listener of listeners.get(type) ?? []) {
			listener({
				...properties,
				waitUntil: (promise) => pending.push(Promise.resolve(promise)),
				respondWith: (promise) => {
					if (response) throw new Error('respondWith called more than once');
					response = Promise.resolve(promise);
				}
			});
		}
		return { response, completed: Promise.all(pending) };
	}
	const fetcher: typeof fetch = async (input, init) => {
		const request = requestFor(input, init);
		const event = dispatch('fetch', { request });
		await event.completed;
		// As in a browser, absence of respondWith lets the original network fetch
		// happen outside the worker. Do not manufacture a successful fallback.
		return event.response ?? network(request);
	};
	return {
		entries,
		caches: cacheStorage,
		network,
		dispatch,
		fetcher,
		skipWaiting,
		claim,
		async install() {
			await dispatch('install').completed;
		},
		async activate() {
			await dispatch('activate').completed;
		}
	};
}

function navigation(path: string) {
	const request = requestFor(path);
	// Node's Request constructor disallows navigate; the real worker receives
	// browser-created Requests with this mode, so model that read-only property.
	Object.defineProperty(request, 'mode', { value: 'navigate' });
	return request;
}

type ShellStatus = {
	type: 'OFFLINE_SHELL_STATUS';
	status: 'ready' | 'outdated' | 'unavailable';
	version: string;
};

async function shellStatus(
	sw: ReturnType<typeof harness>,
	version = appVersion
) {
	const postMessage = vi.fn<(message: ShellStatus) => void>();
	await sw.dispatch('message', {
		data: { type: 'PREPARE_OFFLINE_SHELL', version },
		ports: [{ postMessage }]
	}).completed;
	expect(postMessage).toHaveBeenCalledOnce();
	return postMessage.mock.calls[0][0];
}

async function installedShell(sw: ReturnType<typeof harness>) {
	await sw.install();
	const name = `planit-shell-${appVersion}`;
	expect(await sw.caches.keys()).toContain(name);
	const cache = await sw.caches.open(name);
	const lazyAsset = (await cache.keys()).find((request) =>
		/\/_app\/immutable\/nodes\/[^/]+\.js$/.test(new URL(request.url).pathname)
	);
	expect(
		lazyAsset,
		'production build must include lazy route chunks'
	).toBeDefined();
	return { cache, lazyAsset: lazyAsset! };
}

describe('production SW + real public repository ownership boundary (VM)', () => {
	it.each([
		'/catalogs.json',
		'/courseData.json',
		'/courseDataStripped.json',
		'/_courses/00104031',
		requirementUrl,
		'/_catalogs/2024_200/00002120/en'
	])('leaves public fetch %s to the repository/network', async (path) => {
		const sw = harness();
		const event = sw.dispatch('fetch', { request: requestFor(path) });
		// Settle current-worker work before asserting, so failures leave no jobs.
		await event.completed;
		await event.response;
		expect(
			event.response,
			'SW must not call respondWith for public data'
		).toBeUndefined();
		expect(sw.network).not.toHaveBeenCalled();
	});

	it('does not warm public datasets during service-worker installation', async () => {
		const sw = harness();
		await sw.install();
		const paths = sw.network.mock.calls.map(
			([request]) => new URL(request.url).pathname
		);
		expect(paths).toContain('/offline');
		expect(paths.some((path) => path.startsWith('/_app/immutable/'))).toBe(
			true
		);
		expect(
			paths.filter((path) =>
				/catalogs|courseData|_courses|_catalogs/.test(path)
			)
		).toEqual([]);
		expect(await sw.caches.keys()).not.toContain(legacyDataCache);
	});

	it('ignores obsolete CACHE_LOADED_PUBLIC_DATA messages without fetching or caching', async () => {
		const sw = harness();
		await sw.dispatch('message', {
			data: {
				type: 'CACHE_LOADED_PUBLIC_DATA',
				urls: [new URL(requirementUrl, origin).href, `${origin}/catalogs.json`]
			}
		}).completed;
		expect(sw.network).not.toHaveBeenCalled();
		expect(await sw.caches.keys()).toEqual([]);
	});

	it.each(['network rejection', 'HTTP 503'] as const)(
		'cannot replace a newer valid IDB record with an old CacheStorage 200 after %s',
		async (failure) => {
			const factory = new IDBFactory();
			const store = createIndexedDbStore({ factory });
			const sw = harness(factory);
			try {
				const before = record();
				await store.put(before);
				await (
					await sw.caches.open(legacyDataCache)
				).put(requirementUrl, json(oldData));
				sw.network.mockImplementation(async () => {
					if (failure === 'network rejection')
						throw new TypeError('simulated offline');
					return new Response('unavailable', { status: 503 });
				});
				const repository = createPublicDataRepository({
					store,
					now: () => 1000
				});
				const outcome = await repository
					.revalidate(requirementUrl, sw.fetcher)
					.then(
						(data) => ({ kind: 'resolved', data }),
						() => ({ kind: 'rejected' })
					);
				expect
					.soft(
						outcome.kind,
						'network failure must not become an apparently fresh 200'
					)
					.toBe('rejected');
				expect
					.soft(
						await store.get(requirementUrl),
						'IDB data, validators, timestamp, and revision must all survive'
					)
					.toEqual(before);
				expect(sw.network).toHaveBeenCalledOnce();
				const [request] = sw.network.mock.calls[0];
				expect(request.credentials).toBe('omit');
				expect(request.cache).toBe('no-cache');
				expect(request.headers.get('if-none-match')).toBe('"newer"');
			} finally {
				store.close();
			}
		}
	);

	it('persists a successful public cold load only in IndexedDB', async () => {
		const factory = new IDBFactory();
		const store = createIndexedDbStore({ factory });
		const sw = harness(factory);
		try {
			sw.network.mockImplementation(async () => json(newData, '"newer"'));
			const repository = createPublicDataRepository({ store, now: () => 1000 });
			expect(await repository.get(requirementUrl, sw.fetcher)).toEqual(newData);
			expect(await store.get(requirementUrl)).toMatchObject({
				data: newData,
				validatedAt: 1000,
				etag: '"newer"'
			});
			expect(sw.network).toHaveBeenCalledOnce();
			expect(await sw.caches.keys()).toEqual([]);
		} finally {
			store.close();
		}
	});

	it('serves an already persisted public record offline without involving the SW', async () => {
		const factory = new IDBFactory();
		const store = createIndexedDbStore({ factory });
		const sw = harness(factory);
		try {
			await store.put(record());
			sw.network.mockRejectedValue(new TypeError('offline'));
			const repository = createPublicDataRepository({
				store,
				isOnline: () => false,
				now: () => 10000000
			});
			expect(await repository.get(requirementUrl, sw.fetcher)).toEqual(newData);
			expect(sw.network).not.toHaveBeenCalled();
			expect(await sw.caches.keys()).toEqual([]);
		} finally {
			store.close();
		}
	});

	it('removes the retired v1 public-data CacheStorage cache on activation', async () => {
		const sw = harness();
		await (
			await sw.caches.open(legacyDataCache)
		).put(requirementUrl, json(oldData));
		await sw.activate();
		expect(await sw.caches.keys()).not.toContain(legacyDataCache);
	});
});

describe('production SW shell/privacy/lifecycle guards (VM)', () => {
	it('serves the installed offline shell for app navigation and cached immutable assets', async () => {
		const sw = harness();
		await sw.install();
		const asset = sw.network.mock.calls
			.map(([request]) => new URL(request.url).pathname)
			.find(
				(path) => path.startsWith('/_app/immutable/') && path.endsWith('.js')
			);
		expect(asset).toBeDefined();
		sw.network.mockClear();
		sw.network.mockRejectedValue(new TypeError('offline'));
		for (const path of [
			'/plan',
			'/settings',
			'/course/00104031',
			'/preview/2024_200/00002120/SC00001314_CG00006245'
		]) {
			const event = sw.dispatch('fetch', { request: navigation(path) });
			expect(await (await event.response)!.text()).toBe(offlineHtml);
		}
		const callsBeforeAsset = sw.network.mock.calls.length;
		const event = sw.dispatch('fetch', { request: requestFor(asset!) });
		expect(await (await event.response)!.text()).toBe(`network:${asset}`);
		expect(sw.network).toHaveBeenCalledTimes(callsBeforeAsset);
	});

	it('does not intercept private, authentication, cross-origin, range, or non-GET requests', async () => {
		const sw = harness();
		const requests = [
			requestFor('/api/users/me'),
			navigation('/__auth/handler'),
			navigation('/api/users/me'),
			requestFor('/catalogs.json?token=private'),
			requestFor('https://firestore.googleapis.com/catalogs.json'),
			requestFor('/catalogs.json', {
				headers: { authorization: 'Bearer synthetic-test-only' }
			}),
			requestFor('/catalogs.json', { headers: { range: 'bytes=0-20' } }),
			requestFor('/catalogs.json', {
				method: 'POST',
				body: 'synthetic-test-only'
			}),
			requestFor('/plan', {
				headers: { authorization: 'Bearer synthetic-test-only' }
			}),
			requestFor('/users/synthetic-test-only/plan')
		];
		for (const request of requests) {
			const event = sw.dispatch('fetch', { request });
			await event.completed;
			expect(event.response, request.url).toBeUndefined();
		}
		expect(sw.network).not.toHaveBeenCalled();
		expect(await sw.caches.keys()).toEqual([]);
	});

	it('does not force skipWaiting during installation, activation, or a message', async () => {
		const sw = harness();
		await sw.install();
		await sw.activate();
		await sw.dispatch('message', { data: { type: 'SKIP_WAITING' } }).completed;
		expect(sw.skipWaiting).not.toHaveBeenCalled();
		expect(sw.claim).toHaveBeenCalledOnce();
	});

	it('retains the current shell, unrelated CacheStorage, and all fake IDB records during activation', async () => {
		const factory = new IDBFactory();
		const store = createIndexedDbStore({ factory });
		const unrelatedStore = createIndexedDbStore({
			factory,
			databaseName: 'synthetic-unrelated-test-db'
		});
		try {
			await store.put(record());
			await unrelatedStore.put({
				...record(),
				key: 'synthetic-private-sentinel',
				data: { untouched: true }
			});
			const open = vi.spyOn(factory, 'open');
			const deleteDatabase = vi.spyOn(factory, 'deleteDatabase');
			const sw = harness(factory);
			await sw.install();
			const currentShell = (await sw.caches.keys()).find((name) =>
				name.startsWith('planit-shell-')
			)!;
			await (
				await sw.caches.open('planit-shell-obsolete-test')
			).put('/offline', new Response('old shell'));
			await (
				await sw.caches.open('unrelated-cache')
			).put('/sentinel', new Response('keep me'));
			await (
				await sw.caches.open('planit-public-data-other-product')
			).put('/sentinel', new Response('also keep me'));
			await sw.activate();
			const keys = await sw.caches.keys();
			expect(keys).toContain(currentShell);
			expect(keys).not.toContain('planit-shell-obsolete-test');
			expect(
				await (await sw.caches.match('/sentinel', {
					cacheName: 'unrelated-cache'
				}))!.text()
			).toBe('keep me');
			expect(
				await (await sw.caches.match('/sentinel', {
					cacheName: 'planit-public-data-other-product'
				}))!.text()
			).toBe('also keep me');
			expect(await store.get(requirementUrl)).toEqual(record());
			expect(
				await unrelatedStore.get('synthetic-private-sentinel')
			).toMatchObject({ data: { untouched: true } });
			expect(open).not.toHaveBeenCalled();
			expect(deleteDatabase).not.toHaveBeenCalled();
		} finally {
			store.close();
			unrelatedStore.close();
		}
	});
});

describe('production SW shell readiness and repair handshake (VM)', () => {
	it('confirms the emitted page build only after all installed assets are present, even offline', async () => {
		const sw = harness();
		const { cache } = await installedShell(sw);
		expect(shellEntryPaths.length).toBeGreaterThanOrEqual(2);
		for (const entry of shellEntryPaths)
			expect(await cache.match(entry)).toBeDefined();
		expect(await (await cache.match('/offline'))!.text()).toBe(offlineHtml);
		sw.network.mockClear();
		sw.network.mockRejectedValue(new TypeError('offline'));
		expect(await shellStatus(sw)).toEqual({
			type: 'OFFLINE_SHELL_STATUS',
			status: 'ready',
			version: appVersion
		});
		expect(sw.network).not.toHaveBeenCalled();
		expect(sw.skipWaiting).not.toHaveBeenCalled();
		expect(sw.claim).not.toHaveBeenCalled();
	});

	it('reports a mismatched page build without fetching, caching, or forcing activation', async () => {
		const sw = harness();
		expect(await shellStatus(sw, `${appVersion}-newer-page`)).toEqual({
			type: 'OFFLINE_SHELL_STATUS',
			status: 'outdated',
			version: appVersion
		});
		expect(sw.network).not.toHaveBeenCalled();
		expect(await sw.caches.keys()).toEqual([]);
		expect(sw.skipWaiting).not.toHaveBeenCalled();
		expect(sw.claim).not.toHaveBeenCalled();
	});

	it('repairs only an evicted lazy route asset with credential-free validated requests', async () => {
		const sw = harness();
		const { cache, lazyAsset } = await installedShell(sw);
		const originalKeys = (await cache.keys())
			.map((request) => request.url)
			.sort();
		expect(await cache.delete(lazyAsset)).toBe(true);
		sw.network.mockClear();
		expect(await shellStatus(sw)).toMatchObject({
			status: 'ready',
			version: appVersion
		});
		expect(sw.network).toHaveBeenCalledOnce();
		const [request] = sw.network.mock.calls[0];
		expect(request.url).toBe(lazyAsset.url);
		expect(request.credentials).toBe('omit');
		expect(request.redirect).toBe('error');
		expect(request.cache).toBe('reload');
		expect(await (await cache.match(lazyAsset))!.text()).toBe(
			`network:${new URL(lazyAsset.url).pathname}`
		);
		expect((await cache.keys()).map((entry) => entry.url).sort()).toEqual(
			originalKeys
		);
		expect(sw.skipWaiting).not.toHaveBeenCalled();
	});

	it('rechecks prior readiness after eviction, reports offline failure, and can retry online', async () => {
		const sw = harness();
		const { cache, lazyAsset } = await installedShell(sw);
		expect(await shellStatus(sw)).toMatchObject({ status: 'ready' });
		await cache.delete(lazyAsset);
		sw.network.mockClear();
		sw.network.mockRejectedValue(new TypeError('offline'));
		expect(await shellStatus(sw)).toEqual({
			type: 'OFFLINE_SHELL_STATUS',
			status: 'unavailable',
			version: appVersion
		});
		expect(sw.network).toHaveBeenCalledOnce();
		expect(await cache.match(lazyAsset)).toBeUndefined();
		expect(await (await cache.match('/offline'))!.text()).toBe(offlineHtml);
		sw.network.mockClear();
		sw.network.mockImplementation(shellNetwork);
		expect(await shellStatus(sw)).toMatchObject({ status: 'ready' });
		expect(sw.network).toHaveBeenCalledOnce();
		expect(await cache.match(lazyAsset)).toBeDefined();
		expect(sw.skipWaiting).not.toHaveBeenCalled();
	});

	it('rejects an HTML fallback for a missing route chunk without claiming readiness', async () => {
		const sw = harness();
		const { cache, lazyAsset } = await installedShell(sw);
		await cache.delete(lazyAsset);
		sw.network.mockImplementation(async () => shellResponse());
		expect(await shellStatus(sw)).toMatchObject({ status: 'unavailable' });
		expect(await cache.match(lazyAsset)).toBeUndefined();
		sw.network.mockImplementation(shellNetwork);
		expect(await shellStatus(sw)).toMatchObject({ status: 'ready' });
	});

	const rejectedShells = [
		{
			name: 'HTML from another build',
			response: () =>
				shellResponse(
					shellEntryPaths.reduce(
						(html, entry) =>
							html.replaceAll(entry, entry.replace('/entry/', '/entry/other-')),
						offlineHtml
					)
				)
		},
		{
			name: 'HTML whose entry URLs only share the current build prefix',
			response: () =>
				shellResponse(
					shellEntryPaths.reduce(
						(html, entry) =>
							html.replaceAll(entry, `${entry}.different-build.js`),
						offlineHtml
					)
				)
		},
		{
			name: 'HTML missing the current app entry',
			response: () =>
				shellResponse(
					offlineHtml.replaceAll(
						shellEntryPaths.find((entry) => entry.includes('/app.'))!,
						'/_app/immutable/entry/app.other-build.js'
					)
				)
		},
		{
			name: 'a non-HTML response containing the right entry paths',
			response: () =>
				shellResponse(offlineHtml, {
					headers: { 'content-type': 'text/plain' }
				})
		},
		{
			name: 'a private response',
			response: () =>
				shellResponse(offlineHtml, {
					headers: { 'cache-control': 'private, max-age=0' }
				})
		},
		{
			name: 'a no-store response',
			response: () =>
				shellResponse(offlineHtml, { headers: { 'cache-control': 'NO-STORE' } })
		},
		{
			name: 'an HTTP error response',
			response: () => shellResponse(offlineHtml, { status: 503 })
		},
		{
			name: 'a redirected response',
			response: () => {
				const response = shellResponse();
				Object.defineProperty(response, 'redirected', { value: true });
				return response;
			}
		}
	];

	it.each(rejectedShells)(
		'rejects $name during offline-shell repair without poisoning the cache',
		async ({ response }) => {
			const sw = harness();
			const { cache, lazyAsset } = await installedShell(sw);
			await cache.delete('/offline');
			sw.network.mockClear();
			sw.network.mockImplementation(async () => response());
			expect(await shellStatus(sw)).toMatchObject({
				status: 'unavailable',
				version: appVersion
			});
			expect(sw.network).toHaveBeenCalledOnce();
			expect(new URL(sw.network.mock.calls[0][0].url).pathname).toBe(
				'/offline'
			);
			expect(await cache.match('/offline')).toBeUndefined();
			expect(await cache.match(lazyAsset)).toBeDefined();
			// A rejected repair must not leave a permanently rejected preparation promise.
			sw.network.mockImplementation(shellNetwork);
			expect(await shellStatus(sw)).toMatchObject({ status: 'ready' });
			expect(await (await cache.match('/offline'))!.text()).toBe(offlineHtml);
			expect(sw.skipWaiting).not.toHaveBeenCalled();
		}
	);
});

describe('legacy-controller transition using its saved production bundle (VM)', () => {
	const failures = [
		'network rejection',
		'HTTP 503',
		'HTTP 404',
		'HTTP 410'
	] as const;
	const records = ['valid', 'malformed', 'missing'] as const;
	const cases = records.flatMap((state) =>
		failures.map((failure) => ({ state, failure }))
	);

	it.each(cases)(
		'keeps $state IDB unchanged after $failure without resurrecting legacy data',
		async ({ state, failure }) => {
			const factory = new IDBFactory();
			const store = createIndexedDbStore({ factory });
			const sw = harness(factory, {
				source: legacyBundle,
				filename: legacyBundlePath
			});
			try {
				const before =
					state === 'missing'
						? undefined
						: {
								...record(),
								...(state === 'malformed' ? { data: { invalid: true } } : {})
							};
				if (before) await store.put(before);
				await (
					await sw.caches.open(legacyDataCache)
				).put(requirementUrl, json(oldData));
				const cacheMatch = vi.spyOn(sw.caches, 'match');
				sw.network.mockImplementation(async () => {
					if (failure === 'network rejection')
						throw new TypeError('simulated offline');
					return new Response('unavailable', {
						status: Number(failure.slice(-3))
					});
				});
				const repository = createPublicDataRepository({
					store,
					now: () => 1000,
					bypassServiceWorker: () => true
				});
				const result =
					state === 'valid'
						? repository.revalidate(requirementUrl, sw.fetcher)
						: repository.get(requirementUrl, sw.fetcher);
				await expect(result).rejects.toThrow();
				expect(await store.get(requirementUrl)).toEqual(before);
				expect(
					await store.get(`${requirementUrl}?__planit_idb=1`)
				).toBeUndefined();
				expect(cacheMatch).not.toHaveBeenCalled();
				expect(sw.network).toHaveBeenCalledOnce();
				const [request] = sw.network.mock.calls[0];
				expect(request.url).toBe(`${origin}${requirementUrl}?__planit_idb=1`);
				expect(request.credentials).toBe('omit');
				expect(request.cache).toBe('no-cache');
				expect(request.redirect).toBe('error');
				expect(request.headers.get('if-none-match')).toBe(
					state === 'valid' ? '"newer"' : null
				);
				expect(
					await (await (
						await sw.caches.open(legacyDataCache)
					).match(requirementUrl))!.json()
				).toEqual(oldData);
			} finally {
				store.close();
			}
		}
	);

	it('proves the saved legacy bundle still reproduces stale rollback when the bypass is disabled', async () => {
		const factory = new IDBFactory();
		const store = createIndexedDbStore({ factory });
		const sw = harness(factory, {
			source: legacyBundle,
			filename: legacyBundlePath
		});
		try {
			await store.put(record());
			await (
				await sw.caches.open(legacyDataCache)
			).put(requirementUrl, json(oldData));
			sw.network.mockRejectedValue(new TypeError('simulated offline'));
			const repository = createPublicDataRepository({
				store,
				now: () => 1000,
				bypassServiceWorker: () => false
			});
			expect(await repository.revalidate(requirementUrl, sw.fetcher)).toEqual(
				oldData
			);
			expect(await store.get(requirementUrl)).toMatchObject({
				data: oldData,
				validatedAt: 1000,
				etag: '"older"'
			});
		} finally {
			store.close();
		}
	});

	it.each([200, 304])(
		'uses only the canonical IDB key for a successful bypassed HTTP %s refresh',
		async (status) => {
			const factory = new IDBFactory();
			const store = createIndexedDbStore({ factory });
			const sw = harness(factory, {
				source: legacyBundle,
				filename: legacyBundlePath
			});
			try {
				await store.put(record());
				await (
					await sw.caches.open(legacyDataCache)
				).put(requirementUrl, json(oldData));
				const newest = { ...newData, en: 'Newest requirements', points: 140 };
				const expected = status === 200 ? newest : newData;
				sw.network.mockImplementation(async () =>
					status === 200
						? json(newest, '"newest"')
						: new Response(null, { status: 304 })
				);
				const cacheMatch = vi.spyOn(sw.caches, 'match');
				const repository = createPublicDataRepository({
					store,
					now: () => 1000,
					bypassServiceWorker: () => true
				});
				expect(await repository.revalidate(requirementUrl, sw.fetcher)).toEqual(
					expected
				);
				expect(await store.get(requirementUrl)).toMatchObject({
					key: requirementUrl,
					data: expected,
					validatedAt: 1000,
					etag: status === 200 ? '"newest"' : '"newer"'
				});
				expect(
					await store.get(`${requirementUrl}?__planit_idb=1`)
				).toBeUndefined();
				expect(sw.network).toHaveBeenCalledOnce();
				expect(sw.network.mock.calls[0][0].url).toBe(
					`${origin}${requirementUrl}?__planit_idb=1`
				);
				expect(cacheMatch).not.toHaveBeenCalled();
				expect(
					await (await (
						await sw.caches.open(legacyDataCache)
					).match(requirementUrl))!.json()
				).toEqual(oldData);
			} finally {
				store.close();
			}
		}
	);
});

describe('two actual production worker versions sharing CacheStorage (VM)', () => {
	it('keeps the prior shell until explicit activation, then removes its namespace and retains current assets', async () => {
		const factory = new IDBFactory();
		const store = createIndexedDbStore({ factory });
		try {
			await store.put(record());
			const old = harness(factory, {
				source: legacyBundle,
				filename: legacyBundlePath
			});
			old.network.mockImplementation(
				async (request) => new Response(`old:${new URL(request.url).pathname}`)
			);
			await old.install();
			await old.activate();
			const oldShell = (await old.caches.keys()).find((name) =>
				name.startsWith('planit-shell-')
			)!;
			const oldAssets = await (await old.caches.open(oldShell)).keys();
			expect(
				oldAssets.some((request) =>
					new URL(request.url).pathname.startsWith('/_app/immutable/')
				)
			).toBe(true);
			await (
				await old.caches.open('unrelated-two-version-sentinel')
			).put('/sentinel', new Response('unchanged'));
			const current = harness(factory, { entries: old.entries });
			current.network.mockImplementation(async (request) =>
				new URL(request.url).pathname === '/offline'
					? shellResponse()
					: new Response(`new:${new URL(request.url).pathname}`)
			);
			await current.install();
			const bothShells = (await current.caches.keys()).filter((name) =>
				name.startsWith('planit-shell-')
			);
			expect(bothShells).toHaveLength(2);
			const currentShell = bothShells.find((name) => name !== oldShell)!;
			expect(currentShell).toBeDefined();
			expect(current.skipWaiting).not.toHaveBeenCalled();
			expect(current.claim).not.toHaveBeenCalled();
			expect(await current.caches.keys()).toContain(legacyDataCache);
			expect(
				await (await old.caches.match('/offline', {
					cacheName: oldShell
				}))!.text()
			).toBe('old:/offline');

			// Explicit test dispatch controls activation; this is not proof of a
			// browser's waiting/controller lifecycle or of multi-tab behavior.
			await current.activate();
			expect(await current.caches.keys()).not.toContain(oldShell);
			expect(await current.caches.keys()).not.toContain(legacyDataCache);
			expect(await current.caches.keys()).toContain(currentShell);
			for (const request of oldAssets)
				expect(
					await current.caches.match(request, { cacheName: oldShell })
				).toBeUndefined();
			const currentAssets = await (
				await current.caches.open(currentShell)
			).keys();
			const immutable = currentAssets.filter((request) =>
				new URL(request.url).pathname.startsWith('/_app/immutable/')
			);
			expect(immutable.length).toBeGreaterThan(0);
			current.network.mockClear();
			current.network.mockRejectedValue(new TypeError('offline after update'));
			for (const request of immutable) {
				const event = current.dispatch('fetch', { request });
				expect(await (await event.response)!.text()).toBe(
					`new:${new URL(request.url).pathname}`
				);
			}
			expect(current.network).not.toHaveBeenCalled();
			const navigationEvent = current.dispatch('fetch', {
				request: navigation('/plan')
			});
			expect(await (await navigationEvent.response)!.text()).toBe(offlineHtml);
			expect(
				await (await current.caches.match('/sentinel', {
					cacheName: 'unrelated-two-version-sentinel'
				}))!.text()
			).toBe('unchanged');
			expect(await store.get(requirementUrl)).toEqual(record());
			expect(current.skipWaiting).not.toHaveBeenCalled();
			expect(current.claim).toHaveBeenCalledOnce();
		} finally {
			store.close();
		}
	});
});
