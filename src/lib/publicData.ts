import type { DataLoadingProgress } from './consoleLoading';
import {
	createIndexedDbStore,
	type CachedResource,
	type PublicDataStore
} from './publicDataStore';
import { isPublicData, isPublicDataUrl } from './publicDataSchema';
import { createCourseDataStore, type CourseDataStore } from './courseDataStore';

export const PUBLIC_DATA_SCHEMA_VERSION = 1;
export const PUBLIC_DATA_MAX_AGE = 60 * 60 * 1000;
export const PUBLIC_DATA_BOOT_URLS = [
	'/catalogs.json',
	'/courseDataStripped.json'
] as const;

export type PublicDataRefreshError = { url: string; message: string };

/** One error per canonical public URL; only that URL's successful refresh clears it. */
export function createPublicDataRefreshStatus() {
	const errors = new Map<string, string>();
	const listeners = new Set<(errors: PublicDataRefreshError[]) => void>();
	const current = () =>
		Array.from(errors, ([url, message]) => ({ url, message }));
	function notify(listener: (errors: PublicDataRefreshError[]) => void) {
		try {
			listener(current());
		} catch (error) {
			// Report view bugs without misclassifying a validated download as failed.
			if (typeof globalThis.reportError === 'function')
				globalThis.reportError(error);
			else console.error('Public data status subscriber failed', error);
		}
	}
	function publish() {
		for (const listener of listeners) notify(listener);
	}
	return {
		current,
		summary: () =>
			current()
				.map(({ url, message }) =>
					message.includes(url) ? message : `${url}: ${message}`
				)
				.join(' ') || undefined,
		failed(url: string, error: unknown) {
			const message =
				error instanceof Error && error.message
					? error.message
					: 'Public data refresh failed.';
			if (errors.get(url) === message) return;
			errors.set(url, message);
			publish();
		},
		succeeded(url: string) {
			if (errors.delete(url)) publish();
		},
		subscribe(listener: (errors: PublicDataRefreshError[]) => void) {
			listeners.add(listener);
			notify(listener);
			return () => {
				listeners.delete(listener);
			};
		}
	};
}

const browserRefreshStatus = createPublicDataRefreshStatus();
export const subscribePublicDataRefreshErrors = browserRefreshStatus.subscribe;
export const readPublicDataRefreshError = browserRefreshStatus.summary;

type Options = {
	store: PublicDataStore | null;
	now?: () => number;
	isOnline?: () => boolean;
	maxAgeMs?: number;
	requestTimeoutMs?: number;
	bypassServiceWorker?: () => boolean;
	refreshStatus?: ReturnType<typeof createPublicDataRefreshStatus>;
};

function cachedResource(value: unknown, key: string): value is CachedResource {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as CachedResource;
	return (
		entry.key === key &&
		entry.schemaVersion === PUBLIC_DATA_SCHEMA_VERSION &&
		typeof entry.validatedAt === 'number' &&
		Number.isFinite(entry.validatedAt) &&
		entry.validatedAt >= 0 &&
		(entry.revision === undefined || typeof entry.revision === 'string') &&
		(entry.etag === undefined || typeof entry.etag === 'string') &&
		(entry.lastModified === undefined ||
			typeof entry.lastModified === 'string') &&
		isPublicData(key, entry.data)
	);
}

function conditionalHeaders(previous?: CachedResource) {
	const headers = new Headers();
	const invalid: string[] = [];
	for (const [name, value] of [
		['If-None-Match', previous?.etag],
		['If-Modified-Since', previous?.lastModified]
	]) {
		if (!value) continue;
		try {
			headers.set(name!, value);
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			invalid.push(name!);
		}
	}
	// One corrupt validator makes this a deliberate full replacement request.
	return { headers: invalid.length ? new Headers() : headers, invalid };
}

/** Cache public JSON only. Plan storage and Firebase never pass through here. */
export function createPublicDataRepository({
	store,
	now = Date.now,
	isOnline = () =>
		typeof navigator === 'undefined' || navigator.onLine !== false,
	maxAgeMs = PUBLIC_DATA_MAX_AGE,
	requestTimeoutMs = 15000,
	refreshStatus = createPublicDataRefreshStatus(),
	bypassServiceWorker = () => {
		try {
			return (
				typeof navigator !== 'undefined' &&
				!!navigator.serviceWorker?.controller
			);
		} catch {
			return false;
		}
	}
}: Options) {
	type RefreshResult = { data: unknown; persistenceError?: Error };
	const pending = new Map<string, Promise<RefreshResult>>();

	async function read(
		key: string
	): Promise<{ cached?: CachedResource; revision: string | null }> {
		try {
			const value = await store?.get(key);
			const revision =
				typeof value === 'object' &&
				value !== null &&
				'revision' in value &&
				typeof value.revision === 'string'
					? value.revision
					: null;
			return {
				cached: cachedResource(value, key) ? value : undefined,
				revision
			};
		} catch {
			// Private browsing, blocked upgrades, and unavailable storage are optional-cache failures.
			return { revision: null };
		}
	}

	function refresh(
		key: string,
		fetcher: typeof fetch,
		previous?: CachedResource,
		expectedRevision: string | null = null
	): Promise<RefreshResult> {
		const existing = pending.get(key);
		if (existing) return existing;
		let validatorError: Error | undefined;
		function failureWithCorruption(error: unknown): unknown {
			if (!validatorError) return error;
			const reason =
				error instanceof Error && error.message
					? error.message
					: 'Public data refresh failed.';
			return new Error(`${validatorError.message} Repair failed: ${reason}`, {
				cause: error
			});
		}
		const operation = (async () => {
			const { headers, invalid } = conditionalHeaders(previous);
			if (invalid.length) {
				validatorError = new Error(
					`Corrupt cached HTTP validator (${invalid.join(', ')}): ${key}`
				);
				refreshStatus.failed(key, validatorError);
			}
			const controller = new AbortController();
			let timer: ReturnType<typeof setTimeout>;
			const timeout = new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					controller.abort();
					reject(new Error(`Timed out loading public data: ${key}`));
				}, requestTimeoutMs);
			});
			try {
				const response = await Promise.race([
					// Older installed workers ignore query URLs, avoiding their stale
					// CacheStorage fallback while a shell-only update waits safely.
					fetcher(bypassServiceWorker() ? `${key}?__planit_idb=1` : key, {
						headers,
						signal: controller.signal,
						cache: 'no-cache',
						credentials: 'omit',
						redirect: 'error'
					}),
					timeout
				]);
				if (
					response.redirected ||
					['opaque', 'opaqueredirect'].includes(response.type)
				)
					throw new Error(`Unexpected public data response: ${key}`);
				let data: unknown;
				if (response.status === 304 && previous && !validatorError)
					data = previous.data;
				else {
					if (!response.ok) {
						const name =
							key === '/catalogs.json' ? 'catalogs' : `public data ${key}`;
						throw new Error(`Failed to load ${name} (${response.status})`);
					}
					data = await Promise.race([response.json(), timeout]);
					if (!isPublicData(key, data))
						throw new Error(`Invalid public data: ${key}`);
				}
				// SvelteKit guards un-serialized response headers during SSR. There is
				// no persistent server cache, so do not inspect validators in that path.
				if (!store) return { data };
				if (
					response.headers
						.get('content-type')
						?.toLowerCase()
						.includes('text/html')
				)
					throw new Error(`Unexpected HTML public data response: ${key}`);
				if (
					/(?:no-store|private)/i.test(
						response.headers.get('cache-control') ?? ''
					)
				)
					return {
						data,
						persistenceError: new Error(
							`Public data response forbids offline storage: ${key}`
						)
					};
				let written: boolean | void;
				try {
					written = await store.put(
						{
							key,
							revision:
								globalThis.crypto?.randomUUID?.() ??
								`${now()}-${Math.random()}`,
							schemaVersion: PUBLIC_DATA_SCHEMA_VERSION,
							data,
							validatedAt: now(),
							etag:
								response.headers.get('etag') ??
								(response.status === 304 ? previous?.etag : undefined),
							lastModified:
								response.headers.get('last-modified') ??
								(response.status === 304 ? previous?.lastModified : undefined)
						},
						expectedRevision
					);
				} catch (error) {
					return {
						data,
						persistenceError: new Error(`Could not save public data: ${key}`, {
							cause: error
						})
					};
				}
				if (written === false) {
					// Another tab refreshed while this request was in flight. In particular,
					// a late 304 must never restore its older payload over that newer record.
					const current = (await read(key)).cached;
					if (!current)
						return {
							data,
							persistenceError: new Error(
								`Public data changed while saving and its current cache is unavailable: ${key}`
							)
						};
					if (validatorError && conditionalHeaders(current).invalid.length)
						return {
							data: current.data,
							persistenceError: new Error(
								`Current public data still has corrupt HTTP validators: ${key}`
							)
						};
					return { data: current.data };
				}
				return { data };
			} finally {
				clearTimeout(timer!);
			}
		})().then(
			(result) => {
				if (result.persistenceError) {
					const persistenceError = failureWithCorruption(
						result.persistenceError
					) as Error;
					refreshStatus.failed(key, persistenceError);
					return { ...result, persistenceError };
				}
				refreshStatus.succeeded(key);
				return result;
			},
			(error) => {
				const failure = failureWithCorruption(error);
				refreshStatus.failed(key, failure);
				throw failure;
			}
		);
		pending.set(key, operation);
		void operation.finally(() => pending.delete(key)).catch(() => {});
		return operation;
	}

	const repository = {
		async has(key: string): Promise<boolean> {
			return !!(await read(key)).cached;
		},
		async get<T>(key: string, fetcher: typeof fetch = fetch): Promise<T> {
			if (!isPublicDataUrl(key))
				throw new Error(`Not a public data URL: ${key}`);
			const { cached, revision } = await read(key);
			if (cached) {
				if (isOnline() && now() - cached.validatedAt >= maxAgeMs) {
					// Keep valid cached data usable. refresh reports failures before this rejection is consumed.
					void refresh(key, fetcher, cached, revision).catch(() => {});
				}
				return structuredClone(cached.data) as T;
			}
			return structuredClone(
				(await refresh(key, fetcher, undefined, revision)).data
			) as T;
		},
		async warmCore(fetcher: typeof fetch = fetch): Promise<boolean> {
			await Promise.allSettled(
				PUBLIC_DATA_BOOT_URLS.map((key) => repository.get(key, fetcher))
			);
			return (
				await Promise.all(PUBLIC_DATA_BOOT_URLS.map((key) => read(key)))
			).every(({ cached }) => !!cached);
		},
		async revalidate<T>(
			key: string,
			fetcher: typeof fetch = fetch
		): Promise<T> {
			if (!isPublicDataUrl(key))
				throw new Error(`Not a public data URL: ${key}`);
			const { cached, revision } = await read(key);
			const result = await refresh(key, fetcher, cached, revision);
			if (result.persistenceError) throw result.persistenceError;
			return structuredClone(result.data) as T;
		}
	};
	return repository;
}

let browserRepository:
	| ReturnType<typeof createPublicDataRepository>
	| undefined;
let browserCourseRepository:
	| ReturnType<typeof createCourseDataRepository>
	| undefined;

/** Planit's entity-first model: one full JSON download, durable records keyed by code. */
export function createCourseDataRepository({
	store,
	legacyStore,
	...options
}: Omit<Options, 'store'> & {
	store: CourseDataStore;
	legacyStore?: PublicDataStore;
}) {
	const url = '/courseData.json';
	const repository = createPublicDataRepository({
		...options,
		store: {
			async get() {
				let metadata = await store.getMetadata().catch(() => undefined);
				// A previous #218 installation may already hold the full canonical JSON.
				if (!metadata && legacyStore) {
					const legacy = await legacyStore.get(url);
					if (cachedResource(legacy, url)) {
						try {
							await store.replace(
								legacy.data as Record<string, FullCourse>,
								{
									schemaVersion: 1,
									count: Object.keys(legacy.data as object).length,
									validatedAt: legacy.validatedAt,
									etag: legacy.etag,
									lastModified: legacy.lastModified,
									revision: legacy.revision ?? crypto.randomUUID()
								},
								null
							);
							metadata = await store.getMetadata();
						} catch {
							// A failed upgrade must not discard an already usable full cache.
						}
						if (!metadata) return legacy;
					}
				}
				if (!metadata) return undefined;
				return { ...metadata, key: url, data: await store.getCourses() };
			},
			async put(entry, expectedRevision) {
				return store.replace(
					entry.data as Record<string, FullCourse>,
					{
						schemaVersion: 1,
						count: Object.keys(entry.data as object).length,
						validatedAt: entry.validatedAt,
						revision: entry.revision!,
						etag: entry.etag,
						lastModified: entry.lastModified
					},
					expectedRevision
				);
			}
		}
	});
	return {
		async get(
			code: string,
			fetcher: typeof fetch = fetch
		): Promise<FullCourse | undefined> {
			try {
				if (await store.getMetadata()) {
					const course = await store.getCourse(code);
					if (!course || isPublicData(`/_courses/${code}`, course))
						return course;
				}
			} catch {
				// Storage denial must still allow the online app to use the full JSON.
			}
			const courses = await repository.get<Record<string, FullCourse>>(
				url,
				fetcher
			);
			return courses[code];
		},
		all: (fetcher: typeof fetch = fetch) =>
			repository.get<Record<string, FullCourse>>(url, fetcher),
		sync: (fetcher: typeof fetch = fetch) =>
			repository.revalidate(url, fetcher),
		async metadata() {
			try {
				return await store.getMetadata();
			} catch {
				return undefined;
			}
		}
	};
}

function browserRepositories() {
	if (!browserRepository || !browserCourseRepository) {
		const resources = createIndexedDbStore();
		browserRepository = createPublicDataRepository({
			store: resources,
			refreshStatus: browserRefreshStatus
		});
		browserCourseRepository = createCourseDataRepository({
			store: createCourseDataStore(),
			legacyStore: resources,
			refreshStatus: browserRefreshStatus
		});
	}
	return { resources: browserRepository, courses: browserCourseRepository };
}

export async function loadPublicJson<T>(
	url: string,
	fetcher: typeof fetch = fetch
): Promise<T> {
	// No process-wide cache or browser APIs during SSR. Keep SvelteKit's supplied fetch.
	if (typeof window === 'undefined')
		return createPublicDataRepository({ store: null }).get<T>(url, fetcher);
	const { resources, courses } = browserRepositories();
	if (url === '/courseData.json' || url === '/courseDataStripped.json') {
		let records: Record<string, FullCourse>;
		try {
			records = await courses.all(fetcher);
		} catch (error) {
			// Offline upgrades from #218 can have only the stripped legacy cache.
			// It remains usable for previously visited pages, but never means all
			// full course records are ready for offline use.
			if (url === '/courseDataStripped.json')
				return resources.get<T>(url, fetcher);
			throw error;
		}
		if (url === '/courseDataStripped.json') {
			for (const course of Object.values(records)) {
				delete course.about;
				delete course.faculty;
			}
		}
		return records as T;
	}
	if (/^\/_courses\/\d{8}$/.test(url)) {
		const course = await courses
			.get(url.slice('/_courses/'.length), fetcher)
			.catch(() => undefined);
		if (course) return course as T;
		// Preserve old/shared IDs outside the current aggregate and their existing URL.
	}
	return resources.get<T>(url, fetcher);
}

/** Inspect durable state without starting or waiting for network revalidation. */
export async function readPublicCourseDataReadiness() {
	if (typeof window === 'undefined') return { ready: false, courseCount: 0 };
	const { resources, courses } = browserRepositories();
	const metadata = await courses.metadata();
	return {
		ready: !!metadata && (await resources.has('/catalogs.json')),
		courseCount: metadata?.count ?? 0
	};
}

/** Synchronize existing JSON at startup; readiness describes durable offline data. */
export async function preparePublicCourseData(
	fetcher: typeof fetch = fetch,
	onProgress?: (progress: DataLoadingProgress) => void
) {
	if (typeof window === 'undefined') return { ready: false, courseCount: 0 };
	const { resources, courses } = browserRepositories();
	const shouldRefresh = navigator.onLine !== false;
	let refreshed: boolean | undefined;
	if (shouldRefresh) {
		// Retry previously failed selected resources as well as the two core files.
		// Each refresh owns its URL's status; core success cannot erase a degree error.
		const failedResources = browserRefreshStatus
			.current()
			.map(({ url }) => url)
			.filter((url) => url !== '/courseData.json' && url !== '/catalogs.json');
		const pending = new Set([
			'/courseData.json',
			'/catalogs.json',
			...failedResources
		]);
		const total = pending.size;
		const notify = () =>
			onProgress?.({
				completed: total - pending.size,
				total,
				pending: [...pending]
			});
		notify();
		const track = async (url: string, work: Promise<unknown>) => {
			await work;
			// Completion means a validated response, not elapsed time or bytes guessed
			// from Content-Length (which may describe compressed transfer sizes).
			pending.delete(url);
			notify();
		};
		const results = await Promise.allSettled([
			track('/courseData.json', courses.sync(fetcher)),
			track('/catalogs.json', resources.revalidate('/catalogs.json', fetcher)),
			...failedResources.map((url) =>
				track(url, resources.revalidate(url, fetcher))
			)
		]);
		refreshed = results.every((result) => result.status === 'fulfilled');
	} else {
		// Import a full legacy JSON cache if present; no network is needed when ready.
		// Any attempted download failure is already recorded by the common repository.
		if (!(await courses.metadata())) await courses.all(fetcher).catch(() => {});
	}
	const readiness = await readPublicCourseDataReadiness();
	const refreshError = browserRefreshStatus.summary();
	return {
		...readiness,
		...(shouldRefresh
			? { refreshed, ...(refreshError ? { refreshError } : {}) }
			: {})
	};
}

/** Best-effort warming reports actual persistent readiness, not just a live response. */
export async function warmCorePublicData(
	fetcher: typeof fetch = fetch
): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	browserRepository ??= createPublicDataRepository({
		store: createIndexedDbStore(),
		refreshStatus: browserRefreshStatus
	});
	return browserRepository.warmCore(fetcher);
}
