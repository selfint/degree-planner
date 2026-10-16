import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createCourseDataStore } from './courseDataStore';
import { createCourseDataRepository } from './publicData';
import type { CachedResource } from './publicDataStore';

const courses = {
	'00104031': {
		code: '00104031' as CourseCode,
		name: 'Calculus',
		about: 'Full details',
		faculty: 'Math',
		points: 5.5
	},
	'00234114': {
		code: '00234114' as CourseCode,
		name: 'Introduction',
		about: 'Never visited',
		faculty: 'Computer Science'
	}
};
const stores: ReturnType<typeof createCourseDataStore>[] = [];
function create() {
	const store = createCourseDataStore({ factory: new IDBFactory() });
	stores.push(store);
	return store;
}
const response = (data: unknown = courses, headers: HeadersInit = {}) =>
	new Response(JSON.stringify(data), { headers });
afterEach(() => {
	for (const store of stores.splice(0)) store.close();
});

describe('Planit-style course repository', () => {
	it('downloads the existing aggregate once and serves unvisited details by entity key', async () => {
		const store = create();
		const repository = createCourseDataRepository({ store });
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
		expect(await repository.get('00104031', fetcher)).toEqual(
			courses['00104031']
		);
		expect(await repository.get('00234114', fetcher)).toEqual(
			courses['00234114']
		);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher.mock.calls[0][0]).toBe('/courseData.json');
		expect((await store.getMetadata())?.count).toBe(2);
	});
	it('keeps complete records across repository recreation and never needs individual course HTTP', async () => {
		const store = create();
		await createCourseDataRepository({ store }).sync(
			vi.fn<typeof fetch>().mockResolvedValue(response())
		);
		const offline = createCourseDataRepository({
			store,
			isOnline: () => false
		});
		const fetcher = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new TypeError('offline'));
		expect(await offline.get('00234114', fetcher)).toEqual(courses['00234114']);
		expect(await offline.all(fetcher)).toEqual(courses);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('failed, invalid, and private refreshes do not replace or refresh the last good dataset', async () => {
		let now = 100;
		const store = create();
		const repository = createCourseDataRepository({ store, now: () => now });
		await repository.sync(
			vi.fn<typeof fetch>().mockResolvedValue(response(courses, { etag: 'v1' }))
		);
		const before = await store.getMetadata();
		now = 999;
		for (const result of [
			new Response('', { status: 404 }),
			response({ broken: {} })
		]) {
			await expect(
				repository.sync(vi.fn<typeof fetch>().mockResolvedValue(result))
			).rejects.toThrow();
		}
		await repository.sync(
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(response(courses, { 'cache-control': 'no-store' }))
		);
		expect(await store.getMetadata()).toEqual(before);
		expect(await store.getCourses()).toEqual(courses);
	});
	it('uses conditional validators and keeps metadata with the durable records', async () => {
		const store = create();
		const repository = createCourseDataRepository({ store });
		await repository.sync(
			vi.fn<typeof fetch>().mockResolvedValue(response(courses, { etag: 'v1' }))
		);
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(null, { status: 304 }));
		await repository.sync(fetcher);
		expect(
			new Headers(fetcher.mock.calls[0][1]?.headers).get('If-None-Match')
		).toBe('v1');
		expect(await store.getCourses()).toEqual(courses);
	});
	it('imports an old full-JSON IDB cache without network or changing private storage', async () => {
		const entry: CachedResource = {
			key: '/courseData.json',
			schemaVersion: 1,
			validatedAt: 20,
			data: courses,
			revision: 'legacy'
		};
		const store = create();
		const legacyStore = { get: vi.fn().mockResolvedValue(entry), put: vi.fn() };
		const repository = createCourseDataRepository({
			store,
			legacyStore,
			isOnline: () => false
		});
		const fetcher = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new Error('offline'));
		expect(await repository.get('00234114', fetcher)).toEqual(
			courses['00234114']
		);
		expect(await store.getMetadata()).toMatchObject({
			revision: 'legacy',
			count: 2
		});
		expect(legacyStore.put).not.toHaveBeenCalled();
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('remains usable online when storage fails, without claiming durable readiness', async () => {
		const store = create();
		vi.spyOn(store, 'getMetadata').mockRejectedValue(new Error('denied'));
		vi.spyOn(store, 'replace').mockRejectedValue(new Error('quota'));
		const repository = createCourseDataRepository({ store });
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
		expect(await repository.get('00234114', fetcher)).toEqual(
			courses['00234114']
		);
		expect(await repository.metadata()).toBeUndefined();
	});
});

describe('upgrading an existing offline URL cache', () => {
	it('keeps previously cached stripped data and exact course details usable before a full sync', async () => {
		vi.resetModules();
		const factory = new IDBFactory();
		vi.stubGlobal('indexedDB', factory);
		vi.stubGlobal('window', {});
		vi.stubGlobal('navigator', { onLine: false });
		const { createIndexedDbStore } = await import('./publicDataStore');
		const legacy = createIndexedDbStore({ factory });
		try {
			const stripped = {
				'00104031': { code: '00104031', name: 'Calculus', points: 5.5 }
			};
			for (const [key, data] of [
				['/courseDataStripped.json', stripped],
				['/_courses/00104031', courses['00104031']]
			] as const) {
				await legacy.put({
					key,
					data,
					schemaVersion: 1,
					validatedAt: Date.now(),
					revision: key
				});
			}
			const { loadPublicJson, preparePublicCourseData } =
				await import('./publicData');
			const fetcher = vi
				.fn<typeof fetch>()
				.mockRejectedValue(new TypeError('offline'));
			expect(await loadPublicJson('/courseDataStripped.json', fetcher)).toEqual(
				stripped
			);
			expect(await loadPublicJson('/_courses/00104031', fetcher)).toEqual(
				courses['00104031']
			);
			expect(await preparePublicCourseData(fetcher)).toEqual({
				ready: false,
				courseCount: 0
			});
			expect(
				fetcher.mock.calls.every(([url]) => url === '/courseData.json')
			).toBe(true);
		} finally {
			legacy.close();
			vi.unstubAllGlobals();
		}
	});
});

it('reads the legacy full aggregate when migration storage is denied or full', async () => {
	const store = create();
	vi.spyOn(store, 'replace').mockRejectedValue(
		new DOMException('full', 'QuotaExceededError')
	);
	const legacyStore = {
		get: vi
			.fn()
			.mockResolvedValue({
				key: '/courseData.json',
				schemaVersion: 1,
				data: courses,
				validatedAt: Date.now(),
				revision: 'old'
			}),
		put: vi.fn()
	};
	const repository = createCourseDataRepository({
		store,
		legacyStore,
		isOnline: () => false
	});
	const fetcher = vi
		.fn<typeof fetch>()
		.mockRejectedValue(new TypeError('offline'));
	expect(await repository.get('00234114', fetcher)).toEqual(
		courses['00234114']
	);
	expect(await repository.all(fetcher)).toEqual(courses);
	expect(await repository.metadata()).toBeUndefined();
	expect(fetcher).not.toHaveBeenCalled();
});
