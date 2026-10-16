import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
	createPublicDataRepository,
	PUBLIC_DATA_SCHEMA_VERSION
} from './publicData';
import { isPublicData, isPublicDataUrl } from './publicDataSchema';
import {
	createIndexedDbStore,
	type CachedResource,
	type PublicDataStore
} from './publicDataStore';

const url =
	'/_catalogs/2024_200/00002120/SC00001314_CG00006245/requirementsData.json';
const requirement = {
	name: 'requirement',
	en: 'Computer Science',
	he: 'מדעי המחשב',
	points: 120,
	nested: [
		{
			name: 'CG_ONE',
			en: 'Track one',
			he: 'מסלול ראשון',
			courses: ['00104031'],
			nested: []
		}
	]
};
const courses = {
	'00104031': { code: '00104031', name: 'Calculus', points: 5.5 }
};
const manifest = {
	'2024_200': {
		en: '2024 Winter',
		he: '2024 חורף',
		'00002120': {
			en: 'Computer Science',
			he: 'מדעי המחשב',
			SC00001314_CG00006245: { en: 'CS', he: 'מדמ״ח' }
		}
	}
};

function entry(
	key = url,
	data: unknown = requirement,
	validatedAt = 100
): CachedResource {
	return {
		key,
		schemaVersion: PUBLIC_DATA_SCHEMA_VERSION,
		data: structuredClone(data),
		validatedAt,
		etag: '"v1"',
		lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT'
	};
}

function memoryStore(initial: CachedResource[] = []) {
	const values = new Map(
		initial.map((item) => [item.key, structuredClone(item)])
	);
	const store: PublicDataStore = {
		get: vi.fn(async (key) => structuredClone(values.get(key))),
		put: vi.fn(async (item, expectedRevision) => {
			if (
				expectedRevision !== undefined &&
				(values.get(item.key)?.revision ?? null) !== expectedRevision
			)
				return false;
			values.set(item.key, structuredClone(item));
			return true;
		})
	};
	return { values, store };
}

function response(data: unknown, headers?: HeadersInit) {
	return new Response(JSON.stringify(data), { headers });
}

describe('public JSON repository', () => {
	it('does not access guarded SvelteKit response headers during SSR', async () => {
		const fetched = response(courses, { etag: '"server"' });
		Object.defineProperty(fetched, 'headers', {
			get() {
				throw new Error('filterSerializedResponseHeaders');
			}
		});
		expect(
			await createPublicDataRepository({ store: null }).get(
				'/courseData.json',
				async () => fetched
			)
		).toEqual(courses);
	});

	it('cannot roll another tab back when an old conditional request returns a late 304', async () => {
		const factory = new IDBFactory();
		const firstStore = createIndexedDbStore({ factory });
		const secondStore = createIndexedDbStore({ factory });
		try {
			await firstStore.put({ ...entry(), revision: 'original' });
			const first = createPublicDataRepository({
				store: firstStore,
				now: () => 200
			});
			const second = createPublicDataRepository({
				store: secondStore,
				now: () => 200
			});
			let finish!: (response: Response) => void;
			const delayed = vi.fn<typeof fetch>(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					})
			);
			const older = first.revalidate(url, delayed);
			await vi.waitFor(() => expect(delayed).toHaveBeenCalledOnce());
			const updated = {
				...requirement,
				en: 'Newer course requirements',
				he: 'דרישות חדשות'
			};
			await second.revalidate(url, async () =>
				response(updated, { etag: '"v2"' })
			);
			finish(new Response(null, { status: 304 }));
			expect(await older).toEqual(updated);
			expect(await firstStore.get(url)).toMatchObject({
				data: updated,
				etag: '"v2"'
			});
		} finally {
			firstStore.close();
			secondStore.close();
		}
	});
	it('persists a validated cold load with its validators, without sending credentials', async () => {
		const { store, values } = memoryStore();
		const fetcher = vi.fn<typeof fetch>(async () =>
			response(requirement, { etag: '"v2"' })
		);
		const repository = createPublicDataRepository({ store, now: () => 200 });
		expect(await repository.get(url, fetcher)).toEqual(requirement);
		expect(values.get(url)).toEqual({
			key: url,
			schemaVersion: 1,
			revision: expect.any(String),
			data: requirement,
			validatedAt: 200,
			etag: '"v2"',
			lastModified: undefined
		});
		expect(fetcher.mock.calls[0][1]).toMatchObject({
			credentials: 'omit',
			cache: 'no-cache'
		});
	});

	it('reads the persisted snapshot immediately after reload while offline, in both languages', async () => {
		const { store } = memoryStore([entry()]);
		const fetcher = vi.fn<typeof fetch>(async () => {
			throw new Error('offline');
		});
		const repository = createPublicDataRepository({
			store,
			now: () => 99999999,
			isOnline: () => false
		});
		const cached = await repository.get<typeof requirement>(url, fetcher);
		expect(cached.en).toBe(requirement.en);
		expect(cached.he).toBe(requirement.he);
		expect(cached.nested[0].courses).toEqual(['00104031']);
		expect(fetcher).not.toHaveBeenCalled();
		cached.nested.length = 0;
		expect(
			await createPublicDataRepository({ store, isOnline: () => false }).get(
				url,
				fetcher
			)
		).toEqual(requirement);
	});

	it('serves stale data without awaiting refresh and conditionally refreshes a 304', async () => {
		const { store, values } = memoryStore([entry()]);
		let finish!: (response: Response) => void;
		const fetcher = vi.fn<typeof fetch>(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		);
		const repository = createPublicDataRepository({
			store,
			now: () => 200,
			maxAgeMs: 10
		});
		expect(await repository.get(url, fetcher)).toEqual(requirement);
		const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
		expect(headers.get('If-None-Match')).toBe('"v1"');
		expect(headers.get('If-Modified-Since')).toBe(
			'Mon, 01 Jan 2024 00:00:00 GMT'
		);
		finish(new Response(null, { status: 304 }));
		await vi.waitFor(() => expect(values.get(url)?.validatedAt).toBe(200));
		expect(values.get(url)?.data).toEqual(requirement);
		expect(values.get(url)?.etag).toBe('"v1"');
		await repository.get(url, fetcher);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('updates a valid newer snapshot, retaining every custom requirement field', async () => {
		const { store, values } = memoryStore([entry()]);
		const updated = {
			...requirement,
			points: 130,
			count: 2,
			overflow: 'CG_OTHER',
			hook: '(s, p) => p',
			custom: { keep: true }
		};
		const repository = createPublicDataRepository({ store, now: () => 200 });
		expect(
			await repository.revalidate(url, async () =>
				response(updated, { etag: '"v2"' })
			)
		).toEqual(updated);
		expect(values.get(url)?.data).toEqual(updated);
		expect(values.get(url)?.lastModified).toBeUndefined();
	});

	it('refreshes successfully even when a cached HTTP validator is corrupt', async () => {
		const { store, values } = memoryStore([
			{ ...entry(), etag: 'invalid\nheader' }
		]);
		const repository = createPublicDataRepository({ store });
		await repository.revalidate(url, async (_, init) => {
			expect(new Headers(init?.headers).get('If-None-Match')).toBeNull();
			return response(requirement, { etag: '"repaired"' });
		});
		expect(values.get(url)?.etag).toBe('"repaired"');
	});

	it.each([
		['HTTP failure', () => new Response('', { status: 503 })],
		['HTML fallback', () => new Response('<html>offline</html>')],
		['malformed JSON', () => response({ error: 'unavailable' })],
		['missing translation', () => response({ ...requirement, he: null })]
	] as const)('keeps the last good snapshot after %s', async (_, failed) => {
		const previous = entry();
		const { store, values } = memoryStore([previous]);
		const repository = createPublicDataRepository({ store });
		await expect(
			repository.revalidate(url, async () => failed())
		).rejects.toThrow();
		expect(values.get(url)).toEqual(previous);
		expect(
			await createPublicDataRepository({ store, isOnline: () => false }).get(
				url
			)
		).toEqual(requirement);
	});

	it.each(['schemaVersion', 'payload', 'timestamp'] as const)(
		'ignores incompatible cached %s and repairs only after a valid response',
		async (kind) => {
			const previous = entry();
			if (kind === 'schemaVersion') previous.schemaVersion = 999;
			if (kind === 'payload') previous.data = { invalid: true };
			if (kind === 'timestamp') previous.validatedAt = Infinity;
			const { store, values } = memoryStore([previous]);
			const repository = createPublicDataRepository({ store, now: () => 200 });
			expect(
				await repository.get(url, async () => response(requirement))
			).toEqual(requirement);
			expect(values.get(url)?.schemaVersion).toBe(1);
			expect(values.get(url)?.data).toEqual(requirement);
			expect(values.get(url)?.validatedAt).toBe(200);
		}
	);

	it('does not delete incompatible cache data when the network is also unavailable', async () => {
		const previous = { ...entry(), schemaVersion: 999 };
		const { store, values } = memoryStore([previous]);
		await expect(
			createPublicDataRepository({ store }).get(url, async () => {
				throw new Error('offline');
			})
		).rejects.toThrow('offline');
		expect(values.get(url)).toEqual(previous);
	});

	it('fails open when reads are denied and writes exceed quota', async () => {
		const store: PublicDataStore = {
			get: async () => {
				throw new DOMException('denied', 'SecurityError');
			},
			put: async () => {
				throw new DOMException('full', 'QuotaExceededError');
			}
		};
		expect(
			await createPublicDataRepository({ store }).get(
				'/courseData.json',
				async () => response(courses)
			)
		).toEqual(courses);
	});

	it('deduplicates simultaneous cold loads while returning independent copies', async () => {
		const { store } = memoryStore();
		const fetcher = vi.fn<typeof fetch>(async () => response(requirement));
		const repository = createPublicDataRepository({ store });
		const [first, second] = await Promise.all([
			repository.get<typeof requirement>(url, fetcher),
			repository.get<typeof requirement>(url, fetcher)
		]);
		expect(fetcher).toHaveBeenCalledTimes(1);
		first.nested.length = 0;
		expect(second).toEqual(requirement);
	});

	it('keeps identical program IDs separate across catalog years and faculties', async () => {
		const secondUrl = url.replace('2024_200', '2025_200');
		const thirdUrl = url.replace('00002120', '00002100');
		const second = { ...requirement, en: 'Different year', he: 'שנה אחרת' };
		const third = {
			...requirement,
			en: 'Different faculty',
			he: 'פקולטה אחרת'
		};
		const { store } = memoryStore([
			entry(),
			entry(secondUrl, second),
			entry(thirdUrl, third)
		]);
		const repository = createPublicDataRepository({
			store,
			isOnline: () => false
		});
		expect(await repository.get(url)).toEqual(requirement);
		expect(await repository.get(secondUrl)).toEqual(second);
		expect(await repository.get(thirdUrl)).toEqual(third);
	});

	it('rejects private, cross-origin, query-string and legacy leaf URLs before access', async () => {
		const { store } = memoryStore();
		const fetcher = vi.fn<typeof fetch>();
		const repository = createPublicDataRepository({ store });
		for (const path of [
			'/users/me',
			'https://example.com/catalogs.json',
			'/catalogs.json?token=x',
			url.replace('requirementsData.json', 'en'),
			'/_courses/../users',
			'/courseData.json#private'
		]) {
			await expect(repository.get(path, fetcher)).rejects.toThrow(
				'Not a public data URL'
			);
		}
		expect(fetcher).not.toHaveBeenCalled();
		expect(store.get).not.toHaveBeenCalled();
	});

	it('bounds a cold-start request that never settles and reports cache misses honestly', async () => {
		const repository = createPublicDataRepository({
			store: null,
			requestTimeoutMs: 10
		});
		await expect(
			repository.get(url, () => new Promise(() => {}))
		).rejects.toThrow('Timed out');
		await expect(
			repository.get(url, async () => {
				throw new Error('offline cache miss');
			})
		).rejects.toThrow('offline cache miss');
		await expect(
			repository.get(url, async () => new Response(null, { status: 304 }))
		).rejects.toThrow('(304)');
	});
});

describe('public JSON wire compatibility', () => {
	it('accepts all current bilingual catalogs, requirement trees and course maps without changing data', () => {
		for (const key of [
			'/catalogs.json',
			'/courseData.json',
			'/courseDataStripped.json'
		]) {
			const data = JSON.parse(readFileSync(join('static', key), 'utf8'));
			expect(isPublicData(key, data), key).toBe(true);
		}
		let count = 0;
		function visit(directory: string) {
			for (const item of readdirSync(directory, { withFileTypes: true })) {
				const path = join(directory, item.name);
				if (item.isDirectory()) visit(path);
				else if (item.name === 'requirementsData.json') {
					expect(
						isPublicData(
							'/' + path.slice('static/'.length),
							JSON.parse(readFileSync(path, 'utf8'))
						),
						path
					).toBe(true);
					count++;
				}
			}
		}
		visit('static/_catalogs');
		expect(count).toBe(1183);
	});

	it('preserves optional connection lists used by historical data and dependency cards', () => {
		const data = {
			'10400001': {
				code: '10400001',
				name: 'Advanced course',
				points: 5,
				connections: { dependencies: [['10400002']] }
			},
			'10400002': { code: '10400002', name: 'Prerequisite course', points: 5 }
		};
		expect(isPublicData('/courseDataStripped.json', data)).toBe(true);
		expect(isPublicData('/_courses/10400001', data['10400001'])).toBe(true);
	});

	it('rejects empty/invalid payloads but accepts valid per-course data and bilingual manifest', () => {
		expect(isPublicData('/catalogs.json', manifest)).toBe(true);
		expect(isPublicData('/catalogs.json', {})).toBe(false);
		expect(isPublicData('/courseData.json', {})).toBe(false);
		expect(isPublicData('/_courses/00104031', courses['00104031'])).toBe(true);
		expect(isPublicData('/_courses/00104031', { code: '104031' })).toBe(false);
		expect(isPublicDataUrl('/_courses/00104031')).toBe(true);
		expect(
			isPublicData('/_courses/00104031', { code: '00104031', connections: {} })
		).toBe(true);
		expect(
			isPublicData('/_courses/00104031', {
				code: '00104031',
				connections: { dependencies: '00104031' }
			})
		).toBe(false);
		expect(
			isPublicData('/_courses/00104031', { code: '00104031', points: {} })
		).toBe(false);
		expect(isPublicData(url, { ...requirement, points: {} })).toBe(false);
		expect(
			isPublicData(url, {
				...requirement,
				nested: [{ ...requirement.nested[0], amount: 'two' }]
			})
		).toBe(false);
	});
});
