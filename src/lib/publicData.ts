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

type Options = {
	store: PublicDataStore | null;
	now?: () => number;
	isOnline?: () => boolean;
	maxAgeMs?: number;
	requestTimeoutMs?: number;
	bypassServiceWorker?: () => boolean;
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

/** Cache public JSON only. Plan storage and Firebase never pass through here. */
export function createPublicDataRepository({
	store,
	now = Date.now,
	isOnline = () =>
		typeof navigator === 'undefined' || navigator.onLine !== false,
	maxAgeMs = PUBLIC_DATA_MAX_AGE,
	requestTimeoutMs = 15000,
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
	const pending = new Map<string, Promise<unknown>>();

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

	async function write(entry: CachedResource, expectedRevision: string | null) {
		try {
			return await store?.put(entry, expectedRevision);
		} catch {
			// A quota/transaction error must not discard a successful online response.
		}
	}

	function refresh(
		key: string,
		fetcher: typeof fetch,
		previous?: CachedResource,
		expectedRevision: string | null = null
	): Promise<unknown> {
		const existing = pending.get(key);
		if (existing) return existing;
		const operation = (async () => {
			const headers = new Headers();
			for (const [name, value] of [
				['If-None-Match', previous?.etag],
				['If-Modified-Since', previous?.lastModified]
			]) {
				if (!value) continue;
				try {
					headers.set(name!, value);
				} catch {
					// A corrupt cached validator must not prevent an unconditional refresh.
				}
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
				if (response.status === 304 && previous) data = previous.data;
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
				if (!store) return data;
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
					return data;
				const written = await write(
					{
						key,
						revision:
							globalThis.crypto?.randomUUID?.() ?? `${now()}-${Math.random()}`,
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
				if (written === false) {
					// Another tab refreshed while this request was in flight. In particular,
					// a late 304 must never restore its older payload over that newer record.
					return (await read(key)).cached?.data ?? data;
				}
				return data;
			} finally {
				clearTimeout(timer!);
			}
		})();
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
					// Render the last good snapshot immediately, even on a slow/broken connection.
					void refresh(key, fetcher, cached, revision).catch(() => {});
				}
				return structuredClone(cached.data) as T;
			}
			return structuredClone(
				await refresh(key, fetcher, undefined, revision)
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
			return structuredClone(
				await refresh(key, fetcher, cached, revision)
			) as T;
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
		browserRepository = createPublicDataRepository({ store: resources });
		browserCourseRepository = createCourseDataRepository({
			store: createCourseDataStore(),
			legacyStore: resources
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
export async function preparePublicCourseData(fetcher: typeof fetch = fetch) {
	if (typeof window === 'undefined') return { ready: false, courseCount: 0 };
	const { resources, courses } = browserRepositories();
	if (navigator.onLine !== false) {
		await Promise.allSettled([
			courses.sync(fetcher),
			resources.revalidate('/catalogs.json', fetcher)
		]);
	} else {
		// Import a full legacy JSON cache if present; no network is needed when ready.
		if (!(await courses.metadata())) await courses.all(fetcher).catch(() => {});
	}
	return readPublicCourseDataReadiness();
}

/** Best-effort warming reports actual persistent readiness, not just a live response. */
export async function warmCorePublicData(
	fetcher: typeof fetch = fetch
): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	browserRepository ??= createPublicDataRepository({
		store: createIndexedDbStore()
	});
	return browserRepository.warmCore(fetcher);
}
