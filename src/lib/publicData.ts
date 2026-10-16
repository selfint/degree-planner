import {
	createIndexedDbStore,
	type CachedResource,
	type PublicDataStore
} from './publicDataStore';
import { isPublicData, isPublicDataUrl } from './publicDataSchema';

export const PUBLIC_DATA_SCHEMA_VERSION = 1;
export const PUBLIC_DATA_MAX_AGE = 60 * 60 * 1000;

type Options = {
	store: PublicDataStore | null;
	now?: () => number;
	isOnline?: () => boolean;
	maxAgeMs?: number;
	requestTimeoutMs?: number;
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
	requestTimeoutMs = 15000
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
					fetcher(key, {
						headers,
						signal: controller.signal,
						cache: 'no-cache',
						credentials: 'omit'
					}),
					timeout
				]);
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

	return {
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
}

let browserRepository:
	| ReturnType<typeof createPublicDataRepository>
	| undefined;

export function loadPublicJson<T>(
	url: string,
	fetcher: typeof fetch = fetch
): Promise<T> {
	// No process-wide cache or browser APIs during SSR. Keep SvelteKit's supplied fetch.
	if (typeof window === 'undefined')
		return createPublicDataRepository({ store: null }).get<T>(url, fetcher);
	browserRepository ??= createPublicDataRepository({
		store: createIndexedDbStore()
	});
	return browserRepository.get<T>(url, fetcher);
}
