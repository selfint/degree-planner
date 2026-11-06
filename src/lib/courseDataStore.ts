export type CourseDataMetadata = {
	schemaVersion: 1;
	count: number;
	validatedAt: number;
	revision: string;
	etag?: string;
	lastModified?: string;
};

export interface CourseDataStore {
	getMetadata(): Promise<CourseDataMetadata | undefined>;
	getCourse(code: string): Promise<FullCourse | undefined>;
	getCourses(): Promise<Record<string, FullCourse>>;
	replace(
		courses: Record<string, FullCourse>,
		metadata: CourseDataMetadata,
		expectedRevision?: string | null
	): Promise<boolean>;
	close(): void;
}

const COURSES = 'courses';
const META = 'meta';
const METADATA_KEY = 'courses';

function validMetadata(value: unknown): value is CourseDataMetadata {
	if (!value || typeof value !== 'object') return false;
	const metadata = value as CourseDataMetadata;
	return (
		metadata.schemaVersion === 1 &&
		Number.isSafeInteger(metadata.count) &&
		metadata.count > 0 &&
		Number.isFinite(metadata.validatedAt) &&
		metadata.validatedAt >= 0 &&
		typeof metadata.revision === 'string' &&
		metadata.revision.length > 0 &&
		(metadata.etag === undefined || typeof metadata.etag === 'string') &&
		(metadata.lastModified === undefined ||
			typeof metadata.lastModified === 'string')
	);
}

/**
 * Stores public course records only, separately from plans, authentication and
 * the bounded resource cache. Callers validate course contents before writing
 * and validate persisted data before use. A replacement and its metadata commit
 * together, with no per-course eviction or partially published dataset.
 */
export function createCourseDataStore(
	options: {
		factory?: IDBFactory;
		databaseName?: string;
		/** Open timeout; an explicit value also sets the default transaction timeout. */
		timeoutMs?: number;
		transactionTimeoutMs?: number;
	} = {}
): CourseDataStore {
	const databaseName = options.databaseName ?? 'degree-planner-courses';
	const timeoutMs = options.timeoutMs ?? 1500;
	// Thousands of individual course writes need more time than opening the DB.
	const transactionTimeoutMs =
		options.transactionTimeoutMs ?? options.timeoutMs ?? 15_000;
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		throw new RangeError('timeoutMs must be positive and finite');
	}
	if (!Number.isFinite(transactionTimeoutMs) || transactionTimeoutMs <= 0) {
		throw new RangeError('transactionTimeoutMs must be positive and finite');
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
				() => fail(new Error('IndexedDB course open timed out')),
				timeoutMs
			);
			function fail(error: unknown) {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				abort(request?.transaction);
				reject(error);
			}
			cancelOpening = () => fail(new Error('IndexedDB course store closed'));
			try {
				// Lazy lookup keeps imports and adapter creation safe during SSR.
				const factory = options.factory ?? globalThis.indexedDB;
				if (!factory) throw new Error('IndexedDB is unavailable');
				request = factory.open(databaseName, 1);
				request.onblocked = () =>
					fail(new Error('IndexedDB course open blocked'));
				request.onerror = () =>
					fail(request?.error ?? new Error('IndexedDB course open failed'));
				request.onupgradeneeded = () => {
					if (!request) return;
					if (settled) {
						// Open requests cannot be cancelled. Never perform a late upgrade
						// after a timeout, close, or a blocked open has rejected the caller.
						abort(request.transaction);
						request.result.close();
						return;
					}
					try {
						request.result.createObjectStore(COURSES, { keyPath: 'code' });
						request.result.createObjectStore(META, { keyPath: 'key' });
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
		stores: string | string[],
		mode: IDBTransactionMode,
		run: (
			transaction: IDBTransaction,
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
				fail(new Error('IndexedDB course transaction timed out'));
			}, transactionTimeoutMs);
			function fail(error: unknown) {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				reject(error);
			}
			function handle(callback: () => void) {
				return () => {
					if (settled) return;
					try {
						callback();
					} catch (error) {
						abort(transaction);
						fail(error);
					}
				};
			}
			try {
				transaction = connection.transaction(stores, mode);
				transaction.onabort = () =>
					fail(
						transaction?.error ??
							new Error('IndexedDB course transaction aborted')
					);
				transaction.oncomplete = () => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					resolve(result);
				};
				run(transaction, handle, (value) => (result = value));
			} catch (error) {
				abort(transaction);
				fail(error);
			}
		});
	}

	return {
		getMetadata: () =>
			transact<CourseDataMetadata | undefined>(
				[COURSES, META],
				'readonly',
				(transaction, handle, result) => {
					const request = transaction.objectStore(META).get(METADATA_KEY);
					request.onsuccess = handle(() => {
						if (!validMetadata(request.result)) return result(undefined);
						const metadata: CourseDataMetadata & { key?: string } = {
							...request.result
						};
						delete metadata.key;
						// Verify readiness without cloning the full course map. A count and
						// metadata read share the same consistent readonly transaction.
						const count = transaction.objectStore(COURSES).count();
						count.onsuccess = handle(() =>
							result(count.result === metadata.count ? metadata : undefined)
						);
					});
				}
			),
		getCourse: (code) =>
			transact<FullCourse | undefined>(
				COURSES,
				'readonly',
				(transaction, handle, result) => {
					const request = transaction.objectStore(COURSES).get(code);
					request.onsuccess = handle(() => result(request.result));
				}
			),
		getCourses: () =>
			transact<Record<string, FullCourse>>(
				COURSES,
				'readonly',
				(transaction, handle, result) => {
					const request = transaction.objectStore(COURSES).getAll();
					request.onsuccess = handle(() => {
						result(
							Object.fromEntries(
								(request.result as FullCourse[]).map((course) => [
									course.code,
									course
								])
							)
						);
					});
				}
			),
		replace: async (courses, metadata, expectedRevision) => {
			const entries = Object.entries(courses);
			if (!validMetadata(metadata) || metadata.count !== entries.length) {
				throw new TypeError('Invalid course metadata');
			}
			if (entries.some(([code, course]) => !code || course?.code !== code)) {
				throw new TypeError('Course keys must match their codes');
			}
			const nextMetadata = { ...metadata, key: METADATA_KEY };
			return transact<boolean>(
				[COURSES, META],
				'readwrite',
				(transaction, handle, result) => {
					const courseStore = transaction.objectStore(COURSES);
					const metaStore = transaction.objectStore(META);
					const write = () => {
						courseStore.clear();
						for (const [code, course] of entries) {
							courseStore.put({ ...course, code });
						}
						metaStore.put(nextMetadata);
						result(true);
					};
					if (expectedRevision === undefined) {
						write();
						return;
					}
					// Compare under the same readwrite lock as the replacement, including
					// across tabs. A rejected stale refresh must not clear any courses.
					const current = metaStore.get(METADATA_KEY);
					current.onsuccess = handle(() => {
						const value: unknown = current.result;
						const compare = (revision: string | null) => {
							if (revision !== expectedRevision) {
								result(false);
								return;
							}
							write();
						};
						if (!validMetadata(value)) {
							compare(null);
							return;
						}
						// An invalid/incomplete dataset is absent for CAS purposes too, so
						// a null-revision repair cannot overwrite a concurrent valid sync.
						const count = courseStore.count();
						count.onsuccess = handle(() =>
							compare(count.result === value.count ? value.revision : null)
						);
					});
				}
			);
		},
		close() {
			const cancel = cancelOpening;
			opening = undefined;
			cancelOpening = undefined;
			cancel?.();
			database?.close();
			database = undefined;
		}
	};
}
