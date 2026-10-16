import { IDBDatabase, IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCourseDataStore,
	type CourseDataMetadata,
	type CourseDataStore
} from './courseDataStore';

type Options = NonNullable<Parameters<typeof createCourseDataStore>[0]>;
const databaseName = 'courses-test';
const stores: CourseDataStore[] = [];
let factory: IDBFactory;

function create(options: Options = {}) {
	const store = createCourseDataStore({ factory, databaseName, ...options });
	stores.push(store);
	return store;
}

function courses(count = 3, start = 1): Record<string, FullCourse> {
	return Object.fromEntries(
		Array.from({ length: count }, (_, index) => {
			const code = String(start + index).padStart(8, '0') as CourseCode;
			return [
				code,
				{
					code,
					name: `Course ${code}`,
					about: 'תיאור הקורס',
					points: 3,
					connections: {
						dependencies: [['00000099' as CourseCode]],
						adjacent: [],
						exclusive: []
					}
				}
			];
		})
	);
}

function metadata(count = 3, revision = 'initial'): CourseDataMetadata {
	return {
		schemaVersion: 1,
		count,
		validatedAt: 100,
		revision,
		etag: '"courses-v1"',
		lastModified: 'Wed, 14 Oct 2026 00:00:00 GMT'
	};
}

function openRaw(version = 1): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = factory.open(databaseName, version);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function mutateRaw(run: (transaction: IDBTransaction) => void) {
	const connection = await openRaw();
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = connection.transaction(
				['courses', 'meta'],
				'readwrite'
			);
			transaction.oncomplete = () => resolve();
			transaction.onabort = () => reject(transaction.error);
			run(transaction);
		});
	} finally {
		connection.close();
	}
}

function controlledOpen() {
	const connection = {
		close: vi.fn(),
		createObjectStore: vi.fn()
	};
	const transaction = { abort: vi.fn() };
	const request = {
		result: connection,
		transaction,
		onsuccess: null,
		onerror: null,
		onblocked: null,
		onupgradeneeded: null
	} as unknown as IDBOpenDBRequest;
	const factory = { open: vi.fn(() => request) } as unknown as IDBFactory;
	return { factory, request, connection, transaction };
}

beforeEach(() => {
	factory = new IDBFactory();
});

afterEach(() => {
	for (const store of stores.splice(0)) store.close();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('IndexedDB complete course store', () => {
	it('starts empty and persists the complete dataset across close and new adapters', async () => {
		const first = create();
		expect(await first.getMetadata()).toBeUndefined();
		expect(await first.getCourses()).toEqual({});
		expect(await first.getCourse('00000001')).toBeUndefined();
		const data = courses();
		expect(await first.replace(data, metadata())).toBe(true);
		first.close();
		const reloaded = create();
		expect(await reloaded.getCourses()).toEqual(data);
		expect(await reloaded.getMetadata()).toEqual(metadata());
		expect(await first.getCourse('00000001')).toEqual(data['00000001']);
		data['00000001'].name = 'Caller mutation';
		expect((await reloaded.getCourse('00000001'))?.name).toBe(
			'Course 00000001'
		);
		const read = await reloaded.getCourse('00000001');
		read!.connections!.dependencies![0][0] = '00000088' as CourseCode;
		expect(
			(await first.getCourse('00000001'))?.connections?.dependencies
		).toEqual([['00000099']]);
	});

	it('stores every course without the 128-resource cache eviction limit', async () => {
		const store = create();
		const data = courses(350);
		await store.replace(data, metadata(350));
		expect(await store.getCourses()).toEqual(data);
		expect(await store.getCourse('00000001')).toEqual(data['00000001']);
		expect(await store.getCourse('00000350')).toEqual(data['00000350']);
		expect(await store.getMetadata()).toEqual(metadata(350));
		const raw = await openRaw();
		expect([...raw.objectStoreNames]).toEqual(['courses', 'meta']);
		const transaction = raw.transaction(['courses', 'meta']);
		expect(transaction.objectStore('courses').keyPath).toBe('code');
		expect(transaction.objectStore('meta').keyPath).toBe('key');
		raw.close();
	});

	it('reads one course directly by key without reading the full dataset', async () => {
		const store = create();
		await store.replace(courses(), metadata());
		const get = vi.spyOn(IDBObjectStore.prototype, 'get');
		const getAll = vi.spyOn(IDBObjectStore.prototype, 'getAll');
		const cursor = vi.spyOn(IDBObjectStore.prototype, 'openCursor');
		expect(await store.getCourse('00000002')).toEqual(courses()['00000002']);
		expect(get).toHaveBeenCalledExactlyOnceWith('00000002');
		expect(getAll).not.toHaveBeenCalled();
		expect(cursor).not.toHaveBeenCalled();
	});

	it('checks readiness by metadata and count in one transaction without cloning courses', async () => {
		const store = create();
		await store.replace(courses(), metadata());
		const getAll = vi.spyOn(IDBObjectStore.prototype, 'getAll');
		const count = vi.spyOn(IDBObjectStore.prototype, 'count');
		const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
		expect(await store.getMetadata()).toEqual(metadata());
		expect(transaction).toHaveBeenCalledExactlyOnceWith(
			['courses', 'meta'],
			'readonly'
		);
		expect(count).toHaveBeenCalledOnce();
		expect(getAll).not.toHaveBeenCalled();
		await mutateRaw((transaction) => {
			transaction.objectStore('courses').delete('00000001');
		});
		expect(await store.getMetadata()).toBeUndefined();
	});

	it.each([
		{ schemaVersion: 2 },
		{ count: -1 },
		{ count: 0 },
		{ count: 1.5 },
		{ validatedAt: NaN },
		{ revision: '' },
		{ revision: undefined },
		{ etag: 123 }
	])('does not report malformed metadata as ready: %s', async (invalid) => {
		const store = create();
		await store.replace(courses(), metadata());
		await mutateRaw((transaction) => {
			transaction.objectStore('meta').put({
				...metadata(),
				...invalid,
				key: 'courses'
			});
		});
		expect(await store.getMetadata()).toBeUndefined();
	});

	it('replaces old courses instead of merging stale records into the new dataset', async () => {
		const store = create();
		await store.replace(courses(), metadata());
		const replacement = courses(2, 20);
		expect(await store.replace(replacement, metadata(2, 'new'))).toBe(true);
		expect(await store.getCourses()).toEqual(replacement);
		expect(await store.getCourse('00000001')).toBeUndefined();
		expect(await store.getMetadata()).toEqual(metadata(2, 'new'));
	});

	it.each(['metadata', 'count'])(
		'repairs invalid %s with a null expected revision under the write lock',
		async (failure) => {
			const first = create();
			const second = create();
			await first.replace(courses(), metadata());
			await mutateRaw((transaction) => {
				if (failure === 'metadata') {
					transaction
						.objectStore('meta')
						.put({ ...metadata(), schemaVersion: 99, key: 'courses' });
				} else {
					transaction.objectStore('courses').delete('00000001');
				}
			});
			expect(await first.getMetadata()).toBeUndefined();
			const replacement = courses(2, 20);
			expect(
				await second.replace(replacement, metadata(2, 'repaired'), null)
			).toBe(true);
			expect(
				await first.replace(courses(), metadata(3, 'stale repair'), null)
			).toBe(false);
			expect(await first.getCourses()).toEqual(replacement);
			expect(await first.getMetadata()).toEqual(metadata(2, 'repaired'));
		}
	);

	it('rejects a stale cross-tab replacement without clearing courses or changing metadata', async () => {
		const first = create();
		const second = create();
		await first.replace(courses(), metadata(), null);
		const latest = courses(2, 20);
		expect(await second.replace(latest, metadata(2, 'new'), 'initial')).toBe(
			true
		);
		const clear = vi.spyOn(IDBObjectStore.prototype, 'clear');
		const put = vi.spyOn(IDBObjectStore.prototype, 'put');
		expect(await first.replace(courses(), metadata(3, 'late'), 'initial')).toBe(
			false
		);
		expect(clear).not.toHaveBeenCalled();
		expect(put).not.toHaveBeenCalled();
		expect(await first.getCourses()).toEqual(latest);
		expect(await first.getMetadata()).toEqual(metadata(2, 'new'));
	});

	it('serializes two tabs racing the first complete replacement', async () => {
		const first = create();
		const second = create();
		const firstData = courses(3, 1);
		const secondData = courses(2, 20);
		const results = await Promise.all([
			first.replace(firstData, metadata(3, 'first'), null),
			second.replace(secondData, metadata(2, 'second'), null)
		]);
		expect(results.filter(Boolean)).toHaveLength(1);
		const winner = results[0] ? firstData : secondData;
		const winnerMetadata = results[0]
			? metadata(3, 'first')
			: metadata(2, 'second');
		expect(await first.getCourses()).toEqual(winner);
		expect(await second.getCourses()).toEqual(winner);
		expect(await first.getMetadata()).toEqual(winnerMetadata);
	});

	it.each([undefined, null])(
		'resolves successful replacements only after commit (%s)',
		async (expectedRevision) => {
			const store = create();
			const originalPut = IDBObjectStore.prototype.put;
			let resolved = false;
			let resolvedAtMetadataSuccess: boolean | undefined;
			let completed = false;
			vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
				this: IDBObjectStore,
				value,
				key
			) {
				const request = originalPut.call(this, value, key);
				if (this.name === 'meta') {
					this.transaction.addEventListener(
						'complete',
						() => (completed = true)
					);
					request.addEventListener('success', () => {
						queueMicrotask(() => (resolvedAtMetadataSuccess = resolved));
					});
				}
				return request;
			});
			expect(
				await store
					.replace(courses(), metadata(), expectedRevision)
					.then((result) => {
						resolved = true;
						return result;
					})
			).toBe(true);
			expect(resolvedAtMetadataSuccess).toBe(false);
			expect(completed).toBe(true);
			expect(await create().getMetadata()).toEqual(metadata());
		}
	);

	it('also resolves rejected revision comparisons only after transaction completion', async () => {
		const store = create();
		await store.replace(courses(), metadata());
		const originalGet = IDBObjectStore.prototype.get;
		let resolved = false;
		let resolvedAtReadSuccess: boolean | undefined;
		let completed = false;
		vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementationOnce(function (
			this: IDBObjectStore,
			key
		) {
			this.transaction.addEventListener('complete', () => (completed = true));
			const request = originalGet.call(this, key);
			request.addEventListener('success', () => {
				queueMicrotask(() => (resolvedAtReadSuccess = resolved));
			});
			return request;
		});
		expect(
			await store.replace(courses(), metadata(), 'wrong').then((value) => {
				resolved = true;
				return value;
			})
		).toBe(false);
		expect(resolvedAtReadSuccess).toBe(false);
		expect(completed).toBe(true);
	});

	it.each(['courses', 'meta'])(
		'preserves all previous courses and metadata when %s writes exceed quota',
		async (failedStore) => {
			const store = create();
			await store.replace(courses(), metadata());
			const originalPut = IDBObjectStore.prototype.put;
			vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
				this: IDBObjectStore,
				value,
				key
			) {
				if (this.name === failedStore) {
					throw new DOMException('Storage is full', 'QuotaExceededError');
				}
				return originalPut.call(this, value, key);
			});
			await expect(
				store.replace(courses(2, 20), metadata(2, 'new'), 'initial')
			).rejects.toMatchObject({ name: 'QuotaExceededError' });
			expect(await store.getCourses()).toEqual(courses());
			expect(await store.getMetadata()).toEqual(metadata());
		}
	);

	it('rolls back a late abort after clearing, all course writes, and metadata success', async () => {
		const first = create();
		const second = create();
		await first.replace(courses(), metadata());
		const originalPut = IDBObjectStore.prototype.put;
		const put = vi
			.spyOn(IDBObjectStore.prototype, 'put')
			.mockImplementation(function (this: IDBObjectStore, value, key) {
				const request = originalPut.call(this, value, key);
				if (this.name === 'meta') {
					request.addEventListener('success', () => this.transaction.abort());
				}
				return request;
			});
		await expect(
			second.replace(courses(2, 20), metadata(2, 'new'), 'initial')
		).rejects.toThrow(/abort/i);
		expect(await first.getCourses()).toEqual(courses());
		expect(await first.getMetadata()).toEqual(metadata());
		put.mockRestore();
		expect(
			await second.replace(courses(2, 20), metadata(2, 'new'), 'initial')
		).toBe(true);
		expect(await first.getCourses()).toEqual(courses(2, 20));
	});

	it('rolls back all writes when a later course cannot be structured-cloned', async () => {
		const store = create();
		await store.replace(courses(), metadata());
		const replacement = courses(2, 20);
		Object.assign(replacement['00000021'], { invalid: () => undefined });
		await expect(
			store.replace(replacement, metadata(2, 'new'))
		).rejects.toMatchObject({ name: 'DataCloneError' });
		expect(await store.getCourses()).toEqual(courses());
		expect(await store.getMetadata()).toEqual(metadata());
	});

	it('rolls back an asynchronous request failure after new course writes succeed', async () => {
		const store = create();
		await store.replace(courses(), metadata());
		const originalPut = IDBObjectStore.prototype.put;
		vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
			this: IDBObjectStore,
			value,
			key
		) {
			// Adding the existing metadata key fails asynchronously and must abort
			// the entire replacement, including the already successful course writes.
			return this.name === 'meta'
				? this.add(value, key)
				: originalPut.call(this, value, key);
		});
		await expect(
			store.replace(courses(2, 20), metadata(2, 'new'))
		).rejects.toMatchObject({ name: 'ConstraintError' });
		expect(await store.getCourses()).toEqual(courses());
		expect(await store.getMetadata()).toEqual(metadata());
	});

	it('aborts and rolls back a real timed-out write after metadata request success', async () => {
		const seed = create();
		await seed.replace(courses(), metadata());
		const timed = create({ transactionTimeoutMs: 25 });
		const originalPut = IDBObjectStore.prototype.put;
		let metadataWritten = false;
		const put = vi
			.spyOn(IDBObjectStore.prototype, 'put')
			.mockImplementation(function (this: IDBObjectStore, value, key) {
				const request = originalPut.call(this, value, key);
				if (this.name === 'meta') {
					request.addEventListener('success', () => {
						metadataWritten = true;
						const keepAlive = () => {
							this.count().onsuccess = keepAlive;
						};
						keepAlive();
					});
				}
				return request;
			});
		await expect(
			timed.replace(courses(2, 20), metadata(2, 'new'))
		).rejects.toThrow(/timed out/);
		expect(metadataWritten).toBe(true);
		expect(await seed.getCourses()).toEqual(courses());
		expect(await seed.getMetadata()).toEqual(metadata());
		put.mockRestore();
		expect(await timed.replace(courses(2, 20), metadata(2, 'new'))).toBe(true);
	});

	it('rejects inconsistent write metadata and course keys before altering the database', async () => {
		const store = create();
		await store.replace(courses(), metadata());
		await expect(store.replace(courses(2), metadata(3))).rejects.toThrow(
			/metadata/
		);
		await expect(store.replace({}, metadata(0))).rejects.toThrow(/metadata/);
		await expect(
			store.replace(courses(), { ...metadata(), validatedAt: NaN })
		).rejects.toThrow(/metadata/);
		const data = courses();
		data['00000001'].code = '00000009' as CourseCode;
		await expect(store.replace(data, metadata())).rejects.toThrow(/codes/);
		expect(await store.getCourses()).toEqual(courses());
		expect(await store.getMetadata()).toEqual(metadata());
	});

	it('opens lazily and shares one pending connection to the public-only database', async () => {
		vi.stubGlobal('indexedDB', factory);
		const open = vi.spyOn(factory, 'open');
		const store = createCourseDataStore();
		stores.push(store);
		expect(open).not.toHaveBeenCalled();
		await Promise.all([store.getMetadata(), store.getCourse('00000001')]);
		expect(open).toHaveBeenCalledExactlyOnceWith('degree-planner-courses', 1);
	});

	it('uses a quick open deadline and a longer default for complete course transactions', async () => {
		const timeout = vi.spyOn(globalThis, 'setTimeout');
		await create().replace(courses(), metadata());
		expect(timeout.mock.calls.map((call) => call[1])).toContain(1500);
		expect(timeout.mock.calls.map((call) => call[1])).toContain(15_000);
	});

	it('can be created during SSR without IndexedDB and rejects operations cleanly', async () => {
		vi.stubGlobal('indexedDB', undefined);
		const store = create({ factory: undefined });
		await expect(store.getMetadata()).rejects.toThrow(/unavailable/);
		await expect(store.getCourse('00000001')).rejects.toThrow(/unavailable/);
		await expect(store.getCourses()).rejects.toThrow(/unavailable/);
		await expect(store.replace(courses(), metadata())).rejects.toThrow(
			/unavailable/
		);
	});

	it('can retry a denied open when storage access is restored', async () => {
		const store = create();
		vi.spyOn(factory, 'open').mockImplementationOnce(() => {
			throw new DOMException('Storage denied', 'SecurityError');
		});
		await expect(store.getMetadata()).rejects.toMatchObject({
			name: 'SecurityError'
		});
		await store.replace(courses(), metadata());
		expect(await store.getMetadata()).toEqual(metadata());
	});

	it('rejects asynchronous open errors without waiting for its deadline', async () => {
		const pending = controlledOpen();
		const store = create({ factory: pending.factory });
		const rejected = expect(store.getMetadata()).rejects.toMatchObject({
			name: 'UnknownError'
		});
		Object.defineProperty(pending.request, 'error', {
			value: new DOMException('Storage denied', 'UnknownError')
		});
		pending.request.onerror?.(new Event('error'));
		await rejected;
	});

	it('rejects blocked opens and aborts eventual upgrades without resetting prior data', async () => {
		const seed = create();
		await seed.replace(courses(), metadata());
		seed.close();
		const blocker = await openRaw();
		let request: IDBOpenDBRequest;
		const upgradingFactory = {
			open: () => (request = factory.open(databaseName, 2))
		} as unknown as IDBFactory;
		const blocked = create({ factory: upgradingFactory });
		try {
			await expect(blocked.getMetadata()).rejects.toThrow(/blocked/);
			const aborted = new Promise<void>((resolve) => {
				request.addEventListener('error', () => resolve(), { once: true });
			});
			blocker.close();
			await aborted;
			expect(await create().getCourses()).toEqual(courses());
			expect(await create().getMetadata()).toEqual(metadata());
			const connection = await openRaw();
			expect(connection.version).toBe(1);
			connection.close();
		} finally {
			blocker.close();
		}
	});

	it('closes on versionchange and never downgrades or resets a newer database', async () => {
		const store = create();
		await store.replace(courses(), metadata());
		const upgraded = await openRaw(2);
		try {
			await expect(store.getMetadata()).rejects.toMatchObject({
				name: 'VersionError'
			});
			const request = upgraded
				.transaction('courses')
				.objectStore('courses')
				.get('00000001');
			expect(
				await new Promise((resolve, reject) => {
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				})
			).toEqual(courses()['00000001']);
		} finally {
			upgraded.close();
		}
	});

	it('aborts late upgrades and closes late successful connections after open timeout', async () => {
		vi.useFakeTimers();
		const pending = controlledOpen();
		const store = create({ factory: pending.factory, timeoutMs: 10 });
		const rejected = expect(store.getMetadata()).rejects.toThrow(/timed out/);
		await vi.advanceTimersByTimeAsync(10);
		await rejected;
		pending.transaction.abort.mockClear();
		pending.request.onupgradeneeded?.(
			new Event('upgradeneeded') as IDBVersionChangeEvent
		);
		expect(pending.transaction.abort).toHaveBeenCalledOnce();
		expect(pending.connection.createObjectStore).not.toHaveBeenCalled();
		expect(pending.connection.close).toHaveBeenCalledOnce();
		pending.request.onsuccess?.(new Event('success'));
		expect(pending.connection.close).toHaveBeenCalledTimes(2);
	});

	it('cancels pending opens on close and ignores their late results', async () => {
		const pending = controlledOpen();
		const store = create({ factory: pending.factory });
		const rejected = expect(store.getMetadata()).rejects.toThrow(/closed/);
		store.close();
		await rejected;
		pending.request.onsuccess?.(new Event('success'));
		expect(pending.connection.close).toHaveBeenCalledOnce();
	});

	it('can reopen immediately after close without an old open replacing its new connection', async () => {
		const pending = controlledOpen();
		const originalOpen = factory.open.bind(factory);
		const open = vi.spyOn(factory, 'open');
		open.mockImplementationOnce(() => pending.request);
		open.mockImplementation((name, version) => originalOpen(name, version));
		const store = create();
		const rejected = expect(store.getMetadata()).rejects.toThrow(/closed/);
		store.close();
		const replaced = store.replace(courses(), metadata());
		await rejected;
		await replaced;
		pending.request.onsuccess?.(new Event('success'));
		expect(pending.connection.close).toHaveBeenCalledOnce();
		expect(await store.getMetadata()).toEqual(metadata());
		expect(open).toHaveBeenCalledTimes(2);
	});

	it('aborts timed-out transactions and ignores late completion events', async () => {
		const store = create({ timeoutMs: 10 });
		await store.replace(courses(), metadata());
		const transaction = {
			abort: vi.fn(),
			objectStore: () => ({ get: () => ({}) }),
			oncomplete: null,
			onabort: null
		} as unknown as IDBTransaction;
		vi.spyOn(IDBDatabase.prototype, 'transaction').mockReturnValueOnce(
			transaction
		);
		vi.useFakeTimers();
		const rejected = expect(store.getCourse('00000001')).rejects.toThrow(
			/timed out/
		);
		await vi.advanceTimersByTimeAsync(10);
		await rejected;
		expect(transaction.abort).toHaveBeenCalledOnce();
		transaction.oncomplete?.(new Event('complete'));
		vi.useRealTimers();
		expect(await store.getMetadata()).toEqual(metadata());
	});

	it.each([0, -1, Infinity, NaN])('rejects invalid timeout %s', (timeoutMs) => {
		expect(() => create({ timeoutMs })).toThrow(RangeError);
		expect(() => create({ transactionTimeoutMs: timeoutMs })).toThrow(
			RangeError
		);
	});
});
