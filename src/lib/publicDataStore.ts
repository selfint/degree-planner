export type CachedResource = {
	key: string;
	schemaVersion: number;
	data: unknown;
	validatedAt: number;
	etag?: string;
	lastModified?: string;
	revision?: string;
};

export interface PublicDataStore {
	get(key: string): Promise<unknown | undefined>;
	put(
		entry: CachedResource,
		expectedRevision?: string | null
	): Promise<boolean | void>;
}

const STORE = 'resources';
const VALIDATED_AT = 'validatedAt';

/** Best-effort storage for public resources only; callers own validation/fallback. */
export function createIndexedDbStore(
	options: {
		factory?: IDBFactory;
		databaseName?: string;
		timeoutMs?: number;
		maxEntries?: number;
	} = {}
): PublicDataStore & { close(): void } {
	const databaseName = options.databaseName ?? 'degree-planner-public-data';
	const timeoutMs = options.timeoutMs ?? 1500;
	const maxEntries = options.maxEntries ?? 128;
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		throw new RangeError('timeoutMs must be positive and finite');
	}
	if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
		throw new RangeError('maxEntries must be a positive integer');
	}

	let database: IDBDatabase | undefined;
	let opening: Promise<IDBDatabase> | undefined;
	let cancelOpening: (() => void) | undefined;

	function abort(transaction: IDBTransaction | null | undefined) {
		try {
			transaction?.abort();
		} catch {
			// A completed/aborted transaction cannot be aborted again.
		}
	}

	function open(): Promise<IDBDatabase> {
		if (database) return Promise.resolve(database);
		if (opening) return opening;
		const pending = new Promise<IDBDatabase>((resolve, reject) => {
			let request: IDBOpenDBRequest | undefined;
			let settled = false;
			const timer = setTimeout(
				() => fail(new Error('IndexedDB open timed out')),
				timeoutMs
			);
			function fail(error: unknown) {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				abort(request?.transaction);
				reject(error);
			}
			cancelOpening = () => fail(new Error('IndexedDB store closed'));
			try {
				// Resolve lazily: importing/creating the adapter is safe during SSR.
				const factory = options.factory ?? globalThis.indexedDB;
				if (!factory) throw new Error('IndexedDB is unavailable');
				request = factory.open(databaseName, 1);
				request.onblocked = () => fail(new Error('IndexedDB open blocked'));
				request.onerror = () =>
					fail(request?.error ?? new Error('IndexedDB open failed'));
				request.onupgradeneeded = () => {
					if (!request) return;
					if (settled) {
						// An open request cannot be cancelled. Never apply a late upgrade.
						abort(request.transaction);
						request.result.close();
						return;
					}
					try {
						const store = request.result.createObjectStore(STORE, {
							keyPath: 'key'
						});
						store.createIndex(VALIDATED_AT, VALIDATED_AT);
					} catch (error) {
						fail(error);
					}
				};
				request.onsuccess = () => {
					if (!request) return;
					const connection = request.result;
					if (settled) {
						connection.close();
						return;
					}
					settled = true;
					clearTimeout(timer);
					database = connection;
					connection.onversionchange = () => {
						connection.close();
						if (database === connection) database = undefined;
					};
					connection.onclose = () => {
						if (database === connection) database = undefined;
					};
					resolve(connection);
				};
			} catch (error) {
				fail(error);
			}
		});
		opening = pending;
		const clearOpening = () => {
			if (opening === pending) {
				opening = undefined;
				cancelOpening = undefined;
			}
		};
		void pending.then(clearOpening, clearOpening);
		return pending;
	}

	async function transact<T>(
		mode: IDBTransactionMode,
		run: (
			store: IDBObjectStore,
			handle: (callback: () => void) => () => void,
			result: (value: T) => void
		) => void
	): Promise<T> {
		const connection = await open();
		return new Promise<T>((resolve, reject) => {
			let transaction: IDBTransaction | undefined;
			let result: T;
			let settled = false;
			const timer = setTimeout(() => {
				abort(transaction);
				fail(new Error('IndexedDB transaction timed out'));
			}, timeoutMs);
			function fail(error: unknown) {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				reject(error);
			}
			function handle(callback: () => void) {
				return () => {
					try {
						callback();
					} catch (error) {
						abort(transaction);
						fail(error);
					}
				};
			}
			try {
				transaction = connection.transaction(STORE, mode);
				transaction.onabort = () =>
					fail(
						transaction?.error ?? new Error('IndexedDB transaction aborted')
					);
				transaction.oncomplete = () => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					resolve(result);
				};
				run(
					transaction.objectStore(STORE),
					handle,
					(value) => (result = value)
				);
			} catch (error) {
				abort(transaction);
				fail(error);
			}
		});
	}

	return {
		get: (key) =>
			transact<unknown>('readonly', (store, handle, result) => {
				const request = store.get(key);
				request.onsuccess = handle(() => result(request.result));
			}),
		put: (entry, expectedRevision) =>
			transact<boolean | void>('readwrite', (store, handle, result) => {
				const write = () => {
					store.put(entry);
					const count = store.count();
					count.onsuccess = handle(() => {
						let excess = count.result - maxEntries;
						if (excess <= 0) return;
						// The update and oldest-entry eviction commit or roll back together.
						const cursor = store.index(VALIDATED_AT).openCursor();
						cursor.onsuccess = handle(() => {
							if (!cursor.result || excess <= 0) return;
							cursor.result.delete();
							excess -= 1;
							if (excess > 0) cursor.result.continue();
						});
					});
				};
				if (expectedRevision === undefined) {
					write();
					return;
				}
				// Compare and write under the same lock, including across browser tabs.
				const current = store.get(entry.key);
				current.onsuccess = handle(() => {
					const value: unknown = current.result;
					const revision =
						value &&
						typeof value === 'object' &&
						'revision' in value &&
						typeof value.revision === 'string'
							? value.revision
							: null;
					if (revision !== expectedRevision) {
						result(false);
						return;
					}
					write();
					result(true);
				});
			}),
		close() {
			cancelOpening?.();
			database?.close();
			database = undefined;
		}
	};
}
