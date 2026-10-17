import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
	createPublicDataRepository,
	createPublicDataRefreshStatus,
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
	it.each(['private', 'no-store', 'PRIVATE, max-age=0'])(
		'does not persist a response marked %s or advance its cached freshness',
		async (policy) => {
			const { store, values } = memoryStore([entry()]);
			const updated = { ...requirement, points: 130 };
			const repository = createPublicDataRepository({ store, now: () => 200 });
			await expect(
				repository.revalidate(url, async () =>
					response(updated, { 'cache-control': policy })
				)
			).rejects.toThrow('forbids offline storage');
			expect(values.get(url)).toEqual(entry());
			expect(store.put).not.toHaveBeenCalled();
			const cold = memoryStore();
			expect(
				await createPublicDataRepository({ store: cold.store }).get(
					url,
					async () => response(updated, { 'cache-control': policy })
				)
			).toEqual(updated);
			expect(cold.values.size).toBe(0);
		}
	);

	it('does not let no-store 304 renew a persisted timestamp', async () => {
		const { store, values } = memoryStore([entry()]);
		await expect(
			createPublicDataRepository({ store, now: () => 500 }).revalidate(
				url,
				async () =>
					new Response(null, {
						status: 304,
						headers: { 'cache-control': 'no-store' }
					})
			)
		).rejects.toThrow('forbids offline storage');
		expect(values.get(url)).toEqual(entry());
	});

	it.each(['redirected', 'html'])(
		'rejects an unexpected %s response without replacing a valid snapshot',
		async (kind) => {
			const { store, values } = memoryStore([entry()]);
			const fetched = response(
				requirement,
				kind === 'html' ? { 'content-type': 'text/html' } : {}
			);
			if (kind === 'redirected')
				Object.defineProperty(fetched, 'redirected', { value: true });
			await expect(
				createPublicDataRepository({ store }).revalidate(
					url,
					async () => fetched
				)
			).rejects.toThrow('Unexpected');
			expect(values.get(url)).toEqual(entry());
		}
	);

	it('bypasses legacy controlling workers without changing canonical persistent keys', async () => {
		const { store, values } = memoryStore();
		const fetcher = vi.fn<typeof fetch>(async () => response(requirement));
		await createPublicDataRepository({
			store,
			bypassServiceWorker: () => true
		}).get(url, fetcher);
		expect(fetcher.mock.calls[0][0]).toBe(`${url}?__planit_idb=1`);
		expect(fetcher.mock.calls[0][1]).toMatchObject({
			redirect: 'error',
			credentials: 'omit'
		});
		expect([...values.keys()]).toEqual([url]);
	});

	it('warms both boot resources into persistent storage before declaring offline readiness', async () => {
		const { store, values } = memoryStore();
		const fetcher = vi.fn<typeof fetch>(async (key) =>
			response(key === '/catalogs.json' ? manifest : courses)
		);
		const repository = createPublicDataRepository({ store });
		expect(await repository.warmCore(fetcher)).toBe(true);
		expect([...values.keys()].sort()).toEqual([
			'/catalogs.json',
			'/courseDataStripped.json'
		]);
		const offline = vi.fn<typeof fetch>(async () => {
			throw new Error('offline');
		});
		expect(
			await createPublicDataRepository({
				store,
				isOnline: () => false
			}).warmCore(offline)
		).toBe(true);
		expect(offline).not.toHaveBeenCalled();
	});

	it('does not confuse a successful network load with persisted offline readiness', async () => {
		const { store } = memoryStore();
		store.put = async () => {
			throw new DOMException('Quota', 'QuotaExceededError');
		};
		expect(
			await createPublicDataRepository({ store }).warmCore(async (key) =>
				response(key === '/catalogs.json' ? manifest : courses)
			)
		).toBe(false);
		expect(
			await createPublicDataRepository({ store: memoryStore().store }).warmCore(
				async () => {
					throw new Error('offline');
				}
			)
		).toBe(false);
	});

	it('keeps network fallback available when service-worker access is denied', async () => {
		vi.stubGlobal('navigator', {
			get serviceWorker() {
				throw new DOMException('Denied', 'SecurityError');
			}
		});
		try {
			const fetcher = vi.fn<typeof fetch>(async () => response(requirement));
			expect(
				await createPublicDataRepository({ store: memoryStore().store }).get(
					url,
					fetcher
				)
			).toEqual(requirement);
			expect(fetcher.mock.calls[0][0]).toBe(url);
		} finally {
			vi.unstubAllGlobals();
		}
	});

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

	it('reports corrupt cached validators until a full replacement is durably written', async () => {
		const previous = { ...entry(), etag: 'invalid\nheader' };
		const { store, values } = memoryStore([previous]);
		const status = createPublicDataRefreshStatus();
		const write = vi.mocked(store.put).getMockImplementation()!;
		let commit!: () => void;
		vi.mocked(store.put).mockImplementation(
			(value, revision) =>
				new Promise((resolve) => {
					commit = () => {
						void write(value, revision).then(resolve);
					};
				})
		);
		const repository = createPublicDataRepository({
			store,
			refreshStatus: status
		});
		let finish!: (response: Response) => void;
		const operation = repository.revalidate(url, async (_, init) => {
			expect([...new Headers(init?.headers)]).toEqual([]);
			return new Promise<Response>((resolve) => {
				finish = resolve;
			});
		});
		await vi.waitFor(() =>
			expect(status.summary()).toContain(
				'Corrupt cached HTTP validator (If-None-Match)'
			)
		);
		expect(values.get(url)).toEqual(previous);
		finish(response(requirement, { etag: '"repaired"' }));
		await vi.waitFor(() => expect(store.put).toHaveBeenCalledOnce());
		expect(status.summary()).toContain('Corrupt cached HTTP validator');
		expect(values.get(url)).toEqual(previous);
		commit();
		await operation;
		expect(values.get(url)?.etag).toBe('"repaired"');
		expect(status.current()).toEqual([]);
	});

	it.each([
		'network',
		'304',
		'quota',
		'no-store',
		'concurrent-corrupt'
	] as const)(
		'keeps corrupt-validator repair failures visible after %s',
		async (failure) => {
			const previous = { ...entry(), etag: 'invalid\nheader' };
			const { store, values } = memoryStore([previous]);
			if (failure === 'quota')
				vi.mocked(store.put).mockRejectedValue(
					new DOMException('Full', 'QuotaExceededError')
				);
			if (failure === 'concurrent-corrupt')
				vi.mocked(store.put).mockResolvedValue(false);
			const status = createPublicDataRefreshStatus();
			const repository = createPublicDataRepository({
				store,
				refreshStatus: status
			});
			await expect(
				repository.revalidate(url, async (_, init) => {
					expect([...new Headers(init?.headers)]).toEqual([]);
					if (failure === 'network') throw new Error('Connection interrupted');
					if (failure === '304') return new Response(null, { status: 304 });
					return response(
						requirement,
						failure === 'no-store'
							? { 'cache-control': 'no-store' }
							: { etag: '"repaired"' }
					);
				})
			).rejects.toThrow('Repair failed');
			expect(status.summary()).toContain('Corrupt cached HTTP validator');
			expect(status.summary()).toContain('Repair failed');
			expect(values.get(url)).toEqual(previous);
		}
	);

	it('surfaces unexpected validator-construction errors rather than calling them cache corruption', async () => {
		const { store } = memoryStore([entry()]);
		const status = createPublicDataRefreshStatus();
		const repository = createPublicDataRepository({
			store,
			refreshStatus: status
		});
		const fetcher = vi.fn<typeof fetch>();
		const set = vi
			.spyOn(Headers.prototype, 'set')
			.mockImplementationOnce(() => {
				throw new Error('Unexpected header bug');
			});
		try {
			await expect(repository.revalidate(url, fetcher)).rejects.toThrow(
				'Unexpected header bug'
			);
			expect(status.summary()).toContain('Unexpected header bug');
			expect(status.summary()).not.toContain('Corrupt cached');
			expect(fetcher).not.toHaveBeenCalled();
		} finally {
			set.mockRestore();
		}
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

describe('source-owned public refresh errors', () => {
	it.each(['rejected', 'invalid', 'quota', 'no-store'] as const)(
		'reports a selected-degree %s background refresh while preserving valid cached data',
		async (failure) => {
			const { store, values } = memoryStore([entry()]);
			const status = createPublicDataRefreshStatus();
			const repository = createPublicDataRepository({
				store,
				now: () => 200,
				maxAgeMs: 0,
				refreshStatus: status
			});
			if (failure === 'quota')
				vi.mocked(store.put).mockRejectedValue(
					new DOMException('Full', 'QuotaExceededError')
				);
			const fetcher = vi.fn<typeof fetch>(async () => {
				if (failure === 'rejected') throw new Error('Network interrupted');
				if (failure === 'invalid') return response({ invalid: true });
				return response(
					{ ...requirement, points: 130 },
					failure === 'no-store' ? { 'cache-control': 'no-store' } : {}
				);
			});
			expect(await repository.get(url, fetcher)).toEqual(requirement);
			await vi.waitFor(() => expect(status.current()).toHaveLength(1));
			expect(status.current()[0]).toMatchObject({
				url,
				message: expect.any(String)
			});
			expect(status.summary()).toContain(url);
			expect(values.get(url)).toEqual(entry());
		}
	);

	it('reports a failed cold write even when the genuine live response can be used', async () => {
		const { store, values } = memoryStore();
		vi.mocked(store.put).mockRejectedValue(
			new DOMException('Full', 'QuotaExceededError')
		);
		const status = createPublicDataRefreshStatus();
		const repository = createPublicDataRepository({
			store,
			refreshStatus: status
		});
		expect(
			await repository.get(url, async () => response(requirement))
		).toEqual(requirement);
		expect(values.size).toBe(0);
		expect(status.current()).toEqual([
			{ url, message: `Could not save public data: ${url}` }
		]);
	});

	it('clears only the successfully refreshed URL and never clears an error on cached reads', async () => {
		const secondUrl = url.replace('2024_200', '2025_200');
		const status = createPublicDataRefreshStatus();
		const { store } = memoryStore([
			entry(),
			entry(secondUrl),
			entry('/catalogs.json', manifest)
		]);
		const repository = createPublicDataRepository({
			store,
			refreshStatus: status,
			isOnline: () => false
		});
		for (const key of [url, secondUrl])
			await expect(
				repository.revalidate(key, async () => {
					throw new Error('Bad response');
				})
			).rejects.toThrow('Bad response');
		await repository.revalidate('/catalogs.json', async () =>
			response(manifest)
		);
		expect(status.current().map(({ url }) => url)).toEqual([url, secondUrl]);
		await repository.get(url);
		expect(status.current()).toHaveLength(2);
		await repository.revalidate(
			url,
			async () => new Response(null, { status: 304 })
		);
		expect(status.current().map(({ url }) => url)).toEqual([secondUrl]);
	});

	it('publishes immediate independent snapshots, cleans up, and explicitly reports subscriber bugs', () => {
		const status = createPublicDataRefreshStatus();
		const reported = vi.fn();
		vi.stubGlobal('reportError', reported);
		try {
			const broken = status.subscribe(() => {
				throw new Error('View error');
			});
			const mutate = status.subscribe((errors) => {
				if (errors[0]) errors[0].message = 'tampered';
			});
			const listener = vi.fn();
			const stop = status.subscribe(listener);
			expect(listener).toHaveBeenCalledExactlyOnceWith([]);
			status.failed(url, new Error('Real failure'));
			expect(listener).toHaveBeenLastCalledWith([
				{ url, message: 'Real failure' }
			]);
			expect(reported).toHaveBeenCalledWith(
				expect.objectContaining({ message: 'View error' })
			);
			stop();
			broken();
			mutate();
			status.succeeded(url);
			expect(listener).toHaveBeenCalledTimes(2);
			expect(status.current()).toEqual([]);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('retries failed selected-degree URLs with the core files and keeps errors visible until that URL succeeds', async () => {
		vi.resetModules();
		vi.stubGlobal('window', {});
		vi.stubGlobal('navigator', { onLine: true });
		vi.stubGlobal('indexedDB', new IDBFactory());
		const now = vi.spyOn(Date, 'now').mockReturnValue(100);
		try {
			const data = await import('./publicData');
			let rejected = false;
			const fetcher = vi.fn<typeof fetch>(async (key) => {
				if (key === url) {
					if (rejected) throw new Error('Degree refresh rejected');
					return response(requirement);
				}
				return response(key === '/catalogs.json' ? manifest : courses);
			});
			await data.preparePublicCourseData(fetcher);
			await data.loadPublicJson(url, fetcher);
			now.mockReturnValue(100 + data.PUBLIC_DATA_MAX_AGE);
			rejected = true;
			expect(await data.loadPublicJson(url, fetcher)).toEqual(requirement);
			await vi.waitFor(() =>
				expect(data.readPublicDataRefreshError()).toContain(
					'Degree refresh rejected'
				)
			);
			expect(await data.preparePublicCourseData(fetcher)).toMatchObject({
				ready: true,
				refreshed: false,
				refreshError: expect.stringContaining(url)
			});
			rejected = false;
			const result = await data.preparePublicCourseData(fetcher);
			expect(result).toMatchObject({ ready: true, refreshed: true });
			expect(result).not.toHaveProperty('refreshError');
			expect(data.readPublicDataRefreshError()).toBeUndefined();
			expect(fetcher.mock.calls.filter(([key]) => key === url)).toHaveLength(4);
		} finally {
			now.mockRestore();
			vi.unstubAllGlobals();
		}
	});
});
