import { IDBDatabase, IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIndexedDbStore, type CachedResource } from './publicDataStore';

type Options = NonNullable<Parameters<typeof createIndexedDbStore>[0]>;
const databaseName = 'public-data-test';
const stores: ReturnType<typeof createIndexedDbStore>[] = [];
let factory: IDBFactory;

function create(options: Options = {}) {
	const store = createIndexedDbStore({ factory, databaseName, ...options });
	stores.push(store);
	return store;
}

function resource(key: string, validatedAt = 1): CachedResource {
	return {
		key,
		schemaVersion: 1,
		data: { en: 'Public program', he: 'תוכנית' },
		validatedAt,
		etag: '"v1"',
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

async function storedKeys(): Promise<IDBValidKey[]> {
	const connection = await openRaw();
	try {
		return await new Promise((resolve, reject) => {
			const request = connection
				.transaction('resources')
				.objectStore('resources')
				.getAllKeys();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	} finally {
		connection.close();
	}
}

const bootResources = [
	'/catalogs.json',
	'/courseDataStripped.json',
	'/courseData.json'
];

function courseKey(index: number): string {
	return `/_courses/${String(index).padStart(8, '0')}`;
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

describe('IndexedDB public data store', () => {
	it('persists the complete envelope across adapters and a page reload', async () => {
		const first = create();
		const entry = resource('/_catalogs/catalogsData.json');
		expect(await first.get(entry.key)).toBeUndefined();
		await first.put(entry);
		first.close();

		const reloaded = create();
		expect(await reloaded.get(entry.key)).toEqual(entry);
		entry.data = 'caller mutation';
		expect(await reloaded.get(entry.key)).not.toEqual(entry);
	});

	it('keeps catalog, faculty, and program keys separate', async () => {
		const store = create();
		const entries = [
			resource('/_catalogs/2025/1/10/requirementsData.json', 1),
			resource('/_catalogs/2026/1/10/requirementsData.json', 2),
			resource('/_catalogs/2026/2/10/requirementsData.json', 3),
			resource('/_catalogs/2026/2/20/requirementsData.json', 4)
		];
		await Promise.all(entries.map((entry) => store.put(entry)));
		for (const entry of entries) {
			expect(await store.get(entry.key)).toEqual(entry);
		}
	});

	it('rejects a delayed stale refresh after another adapter saved a newer revision', async () => {
		const firstTab = create();
		const secondTab = create();
		const original = { ...resource('program', 1), revision: 'v1' };
		expect(await firstTab.put(original)).toBeUndefined();
		const observed = (await firstTab.get('program')) as CachedResource;
		const latest = {
			...resource('program', 2),
			data: 'new payload',
			revision: 'v2'
		};
		expect(await secondTab.put(latest, 'v1')).toBe(true);
		// A late 304 refresh still carries the old payload, even with a newer timestamp.
		expect(
			await firstTab.put(
				{ ...observed, validatedAt: 100, revision: 'late-304' },
				observed.revision
			)
		).toBe(false);
		expect(await firstTab.get('program')).toEqual(latest);
		expect(await secondTab.get('program')).toEqual(latest);
	});

	it('serializes competing first writes with an explicit null revision', async () => {
		const firstTab = create();
		const secondTab = create();
		const first = { ...resource('program', 1), revision: 'first-tab' };
		const second = { ...resource('program', 2), revision: 'second-tab' };
		const results = await Promise.all([
			firstTab.put(first, null),
			secondTab.put(second, null)
		]);
		expect(results.filter((result) => result === true)).toHaveLength(1);
		expect(results.filter((result) => result === false)).toHaveLength(1);
		const winner = results[0] ? first : second;
		expect(await firstTab.get('program')).toEqual(winner);
		expect(await secondTab.get('program')).toEqual(winner);
	});

	it.each([undefined, null, 123])(
		'refreshes a legacy or malformed record with revision %s using null',
		async (revision) => {
			const firstTab = create();
			const secondTab = create();
			await firstTab.put({
				...resource('program'),
				revision
			} as unknown as CachedResource);
			const refreshed = { ...resource('program', 2), revision: 'refreshed' };
			expect(await secondTab.put(refreshed, null)).toBe(true);
			expect(await firstTab.get('program')).toEqual(refreshed);
			expect(
				await firstTab.put({ ...resource('program'), revision: 'stale' }, null)
			).toBe(false);
		}
	);

	it('does not write or evict anything when the expected revision mismatches', async () => {
		const firstTab = create({ maxEntries: 5 });
		const secondTab = create({ maxEntries: 1 });
		const current = { ...resource('program', 1), revision: 'current' };
		for (const key of bootResources) await firstTab.put(resource(key));
		await firstTab.put(current);
		await firstTab.put(resource(courseKey(1), 2));
		const put = vi.spyOn(IDBObjectStore.prototype, 'put');
		const count = vi.spyOn(IDBObjectStore.prototype, 'count');
		const remove = vi.spyOn(IDBObjectStore.prototype, 'delete');
		expect(
			await secondTab.put(
				{ ...resource('program', 3), revision: 'new' },
				'stale'
			)
		).toBe(false);
		expect(put).not.toHaveBeenCalled();
		expect(count).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
		expect(await firstTab.get('program')).toEqual(current);
		expect(await firstTab.get(courseKey(1))).toEqual(resource(courseKey(1), 2));
		for (const key of bootResources) {
			expect(await firstTab.get(key)).toEqual(resource(key));
		}
		expect(await storedKeys()).toHaveLength(5);
	});

	it('resolves a failed comparison only after its transaction completes', async () => {
		const store = create();
		await store.put({ ...resource('program'), revision: 'current' });
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
		const result = await store
			.put({ ...resource('program', 2), revision: 'new' }, 'stale')
			.then((result) => {
				resolved = true;
				return result;
			});
		expect(result).toBe(false);
		expect(resolvedAtReadSuccess).toBe(false);
		expect(completed).toBe(true);
	});

	it('keeps guarded updates and eviction atomic when quota fails', async () => {
		const firstTab = create({ maxEntries: 1 });
		const secondTab = create({ maxEntries: 1 });
		const saved = { ...resource('saved', 1), revision: 'saved-revision' };
		await firstTab.put(saved);
		vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
			throw new DOMException('Storage is full', 'QuotaExceededError');
		});
		await expect(
			secondTab.put(
				{ ...resource('saved', 2), revision: 'updated' },
				'saved-revision'
			)
		).rejects.toMatchObject({ name: 'QuotaExceededError' });
		expect(await firstTab.get('saved')).toEqual(saved);
		vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementationOnce(() => {
			throw new DOMException('Storage is full', 'QuotaExceededError');
		});
		const newest = { ...resource('new', 3), revision: 'new-revision' };
		await expect(secondTab.put(newest, null)).rejects.toMatchObject({
			name: 'QuotaExceededError'
		});
		expect(await firstTab.get('saved')).toEqual(saved);
		expect(await firstTab.get('new')).toBeUndefined();
		expect(await secondTab.put(newest, null)).toBe(true);
		expect(await firstTab.get('saved')).toBeUndefined();
		expect(await firstTab.get('new')).toEqual(newest);
	});

	it('opens lazily, shares an in-flight open, and uses the public-only database', async () => {
		vi.stubGlobal('indexedDB', factory);
		const open = vi.spyOn(factory, 'open');
		const store = createIndexedDbStore();
		stores.push(store);
		expect(open).not.toHaveBeenCalled();
		await Promise.all([store.get('a'), store.get('b')]);
		expect(open).toHaveBeenCalledExactlyOnceWith(
			'degree-planner-public-data',
			1
		);
	});

	it.each([undefined, null])(
		'does not resolve a write before commit (expected revision %s)',
		async (expectedRevision) => {
			const store = create();
			const originalPut = IDBObjectStore.prototype.put;
			let resolved = false;
			let resolvedAtRequestSuccess: boolean | undefined;
			vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(
				function (this: IDBObjectStore, value, key) {
					const request = originalPut.call(this, value, key);
					request.addEventListener('success', () => {
						queueMicrotask(() => {
							resolvedAtRequestSuccess = resolved;
						});
					});
					return request;
				}
			);
			await store
				.put(resource('a'), expectedRevision)
				.then(() => (resolved = true));
			expect(resolvedAtRequestSuccess).toBe(false);
			expect(resolved).toBe(true);
			expect(await create().get('a')).toEqual(resource('a'));
		}
	);

	it('evicts by validation age and updates entries without growing the cache', async () => {
		const store = create({ maxEntries: 2 });
		await store.put(resource('alphabetically-first', 20));
		await store.put(resource('oldest', 10));
		await store.put(resource('oldest', 30));
		expect(await store.get('alphabetically-first')).toBeDefined();
		await store.put(resource('newest', 40));
		expect(await store.get('alphabetically-first')).toBeUndefined();
		expect(await store.get('oldest')).toEqual(resource('oldest', 30));
		expect(await store.get('newest')).toEqual(resource('newest', 40));
	});

	it('bounds the default cache at 128 entries', async () => {
		const store = create();
		for (let i = 0; i < 129; i++) await store.put(resource(`key-${i}`, i));
		expect(await store.get('key-0')).toBeUndefined();
		expect(await store.get('key-1')).toBeDefined();
		expect(await store.get('key-128')).toBeDefined();
		expect(await storedKeys()).toHaveLength(128);
	});

	it('retains boot resources and requirements after more than 128 course details', async () => {
		const store = create();
		const requirements = [
			'/_catalogs/2025_001/1/10/requirementsData.json',
			'/_catalogs/2026_001/1/10/requirementsData.json'
		];
		for (const key of [...bootResources, ...requirements]) {
			await store.put(resource(key, 0));
		}
		for (let i = 0; i < 140; i++) {
			await store.put(resource(courseKey(i), i + 1));
		}
		for (const key of [...bootResources, ...requirements]) {
			expect(await store.get(key)).toEqual(resource(key, 0));
		}
		// Five retained dependencies leave room for the newest 123 details.
		for (let i = 0; i < 17; i++) {
			expect(await store.get(courseKey(i))).toBeUndefined();
		}
		expect(await store.get(courseKey(17))).toEqual(resource(courseKey(17), 18));
		expect(await store.get(courseKey(139))).toEqual(
			resource(courseKey(139), 140)
		);
		expect(await storedKeys()).toHaveLength(128);
	});

	it('evicts requirements by age only after course details are exhausted', async () => {
		const store = create({ maxEntries: 3 });
		const oldest = '/_catalogs/2025_001/1/10/requirementsData.json';
		const retained = '/_catalogs/2026_001/1/10/requirementsData.json';
		const newest = '/_catalogs/2026_001/2/20/requirementsData.json';
		await store.put(resource('/catalogs.json', 0));
		await store.put(resource(oldest, 1));
		await store.put(resource(courseKey(1), 100));
		await store.put(resource(retained, 2));
		expect(await store.get(courseKey(1))).toBeUndefined();
		expect(await store.get(oldest)).toEqual(resource(oldest, 1));
		await store.put(resource(newest, 3));
		expect(await store.get(oldest)).toBeUndefined();
		expect(await store.get(retained)).toEqual(resource(retained, 2));
		expect(await store.get(newest)).toEqual(resource(newest, 3));
		expect(await store.get('/catalogs.json')).toEqual(
			resource('/catalogs.json', 0)
		);
		expect(await storedKeys()).toHaveLength(3);
	});

	it.each([1, 2])(
		'only exceeds a cap of %s for the fixed three boot resources',
		async (maxEntries) => {
			const store = create({ maxEntries });
			for (const key of bootResources) await store.put(resource(key, 0));
			for (let i = 0; i < 5; i++) {
				await store.put(resource(courseKey(i), i + 1));
				await store.put(
					resource(`/_catalogs/2026_001/1/${i}/requirementsData.json`, i + 1)
				);
				expect((await storedKeys()).sort()).toEqual([...bootResources].sort());
			}
			await store.put(resource('/catalogs.json', 10));
			expect(await store.get('/catalogs.json')).toEqual(
				resource('/catalogs.json', 10)
			);
			for (const key of bootResources.slice(1)) {
				expect(await store.get(key)).toEqual(resource(key, 0));
			}
			expect(await storedKeys()).toHaveLength(3);
		}
	);

	it('rolls back guarded detail eviction without disturbing boot resources or requirements', async () => {
		const store = create({ maxEntries: 5 });
		const requirements = '/_catalogs/2026_001/1/10/requirementsData.json';
		const retained = [...bootResources, requirements, courseKey(1)];
		for (const key of retained) await store.put(resource(key, 1));
		const newest = { ...resource(courseKey(2), 2), revision: 'new' };
		vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
			throw new DOMException('Storage is full', 'QuotaExceededError');
		});
		const originalDelete = IDBObjectStore.prototype.delete;
		const remove = vi.spyOn(IDBObjectStore.prototype, 'delete');
		await expect(store.put(newest, null)).rejects.toMatchObject({
			name: 'QuotaExceededError'
		});
		expect(remove).not.toHaveBeenCalled();
		remove.mockImplementationOnce(function (this: IDBObjectStore, key) {
			const request = originalDelete.call(this, key);
			const transaction = this.transaction;
			request.addEventListener('success', () => transaction.abort());
			return request;
		});
		await expect(store.put(newest, null)).rejects.toThrow(/abort/i);
		for (const key of retained) {
			expect(await store.get(key)).toEqual(resource(key, 1));
		}
		expect(await store.get(newest.key)).toBeUndefined();
		expect(await storedKeys()).toHaveLength(5);
		expect(await store.put(newest, null)).toBe(true);
		expect(await store.get(courseKey(1))).toBeUndefined();
		expect(await store.get(newest.key)).toEqual(newest);
		expect(await storedKeys()).toHaveLength(5);
	});

	it('rolls back the new entry and eviction together after a late transaction failure', async () => {
		const store = create({ maxEntries: 2 });
		await store.put(resource('oldest', 1));
		await store.put(resource('retained', 2));
		const originalDelete = IDBObjectStore.prototype.delete;
		const deleteEntry = vi
			.spyOn(IDBObjectStore.prototype, 'delete')
			.mockImplementationOnce(function (this: IDBObjectStore, key) {
				const request = originalDelete.call(this, key);
				const transaction = this.transaction;
				request.addEventListener('success', () => transaction.abort());
				return request;
			});
		await expect(store.put(resource('newest', 3))).rejects.toThrow(/abort/i);
		expect(deleteEntry).toHaveBeenCalledOnce();
		expect(await store.get('oldest')).toEqual(resource('oldest', 1));
		expect(await store.get('retained')).toEqual(resource('retained', 2));
		expect(await store.get('newest')).toBeUndefined();
	});

	it('preserves the last good entry on quota and structured-clone failures', async () => {
		const store = create();
		await store.put(resource('key', 1));
		vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
			throw new DOMException('Storage is full', 'QuotaExceededError');
		});
		await expect(store.put(resource('key', 2))).rejects.toMatchObject({
			name: 'QuotaExceededError'
		});
		await expect(
			store.put({ ...resource('key', 3), data: () => undefined })
		).rejects.toMatchObject({ name: 'DataCloneError' });
		expect(await store.get('key')).toEqual(resource('key', 1));
	});

	it('rejects and rolls back a failure while scheduling eviction', async () => {
		const store = create({ maxEntries: 1 });
		await store.put(resource('saved', 1));
		vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementationOnce(() => {
			throw new DOMException('Storage is full', 'QuotaExceededError');
		});
		await expect(store.put(resource('new', 2))).rejects.toMatchObject({
			name: 'QuotaExceededError'
		});
		expect(await store.get('saved')).toEqual(resource('saved', 1));
		expect(await store.get('new')).toBeUndefined();
	});

	it('is safe to create without IndexedDB and rejects reads and writes cleanly', async () => {
		vi.stubGlobal('indexedDB', undefined);
		const store = create({ factory: undefined });
		await expect(store.get('key')).rejects.toThrow(/unavailable/);
		await expect(store.put(resource('key'))).rejects.toThrow(/unavailable/);
	});

	it('rejects a denied open and can retry after access is restored', async () => {
		const store = create();
		vi.spyOn(factory, 'open').mockImplementationOnce(() => {
			throw new DOMException('Storage denied', 'SecurityError');
		});
		await expect(store.get('key')).rejects.toMatchObject({
			name: 'SecurityError'
		});
		await store.put(resource('key'));
		expect(await store.get('key')).toEqual(resource('key'));
	});

	it('rejects asynchronous open errors without waiting for the timeout', async () => {
		const pending = controlledOpen();
		const store = create({ factory: pending.factory });
		const rejected = expect(store.get('key')).rejects.toMatchObject({
			name: 'UnknownError'
		});
		Object.defineProperty(pending.request, 'error', {
			value: new DOMException('Storage denied', 'UnknownError')
		});
		pending.request.onerror?.(new Event('error'));
		await rejected;
	});

	it('rejects a blocked open and aborts its eventual upgrade without losing data', async () => {
		const seed = create();
		await seed.put(resource('saved'));
		seed.close();
		const blocker = await openRaw();
		let request: IDBOpenDBRequest;
		const upgradingFactory = {
			open: () => (request = factory.open(databaseName, 2))
		} as unknown as IDBFactory;
		const blocked = create({ factory: upgradingFactory });
		try {
			await expect(blocked.get('saved')).rejects.toThrow(/blocked/);
			const upgradeAborted = new Promise<void>((resolve) => {
				request.addEventListener('error', () => resolve(), { once: true });
			});
			blocker.close();
			await upgradeAborted;
			expect(await create().get('saved')).toEqual(resource('saved'));
			const connection = await openRaw();
			expect(connection.version).toBe(1);
			connection.close();
		} finally {
			blocker.close();
		}
	});

	it('closes on versionchange and never resets a database with a newer version', async () => {
		const store = create();
		await store.put(resource('saved'));
		const upgraded = await openRaw(2);
		try {
			await expect(store.get('saved')).rejects.toMatchObject({
				name: 'VersionError'
			});
			const request = upgraded
				.transaction('resources')
				.objectStore('resources')
				.get('saved');
			const saved = await new Promise((resolve, reject) => {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			expect(saved).toEqual(resource('saved'));
		} finally {
			upgraded.close();
		}
	});

	it('aborts late upgrades and closes late successful opens after timeout', async () => {
		vi.useFakeTimers();
		const pending = controlledOpen();
		const store = create({ factory: pending.factory, timeoutMs: 10 });
		const rejected = expect(store.get('key')).rejects.toThrow(/timed out/);
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

	it('cancels an in-flight open on close and closes any late connection', async () => {
		const pending = controlledOpen();
		const store = create({ factory: pending.factory });
		const rejected = expect(store.get('key')).rejects.toThrow(/closed/);
		store.close();
		await rejected;
		pending.request.onsuccess?.(new Event('success'));
		expect(pending.connection.close).toHaveBeenCalledOnce();
	});

	it('aborts a timed-out transaction and ignores its late completion', async () => {
		const store = create({ timeoutMs: 10 });
		await store.put(resource('saved'));
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
		const rejected = expect(store.get('saved')).rejects.toThrow(/timed out/);
		await vi.advanceTimersByTimeAsync(10);
		await rejected;
		expect(transaction.abort).toHaveBeenCalledOnce();
		transaction.oncomplete?.(new Event('complete'));
		vi.useRealTimers();
		expect(await store.get('saved')).toEqual(resource('saved'));
	});
});
