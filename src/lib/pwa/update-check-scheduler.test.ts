import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createUpdateCheckScheduler,
	UPDATE_CHECK_INTERVAL_MS,
	UPDATE_CHECK_STORAGE_KEY,
	UPDATE_CHECK_TIMEOUT_MS
} from './update-check-scheduler';

const ORIGIN = 'https://planit.test';
const START = Date.UTC(2026, 9, 25, 12);
const HOUR = 60 * 60 * 1000;
const schedulers: ReturnType<typeof createUpdateCheckScheduler>[] = [];
type SchedulerOptions = NonNullable<
	Parameters<typeof createUpdateCheckScheduler>[1]
>;
type CheckRecord = { lastAttemptAt: number; lastCheckedAt?: number };

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

function storage() {
	const values = new Map<string, string>();
	const api = {
		get length() {
			return values.size;
		},
		clear: vi.fn(() => values.clear()),
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			values.set(key, value);
		}),
		removeItem: vi.fn((key: string) => {
			values.delete(key);
		}),
		key: vi.fn((index: number) => [...values.keys()][index] ?? null)
	} satisfies Storage;
	return {
		api,
		seed(value: unknown) {
			values.set(UPDATE_CHECK_STORAGE_KEY, JSON.stringify(value));
		},
		seedRaw(value: string) {
			values.set(UPDATE_CHECK_STORAGE_KEY, value);
		},
		record(): CheckRecord | undefined {
			const raw = values.get(UPDATE_CHECK_STORAGE_KEY);
			return raw === undefined ? undefined : JSON.parse(raw);
		}
	};
}

function worker(scriptURL = `${ORIGIN}/service-worker.js`) {
	// The scheduler only reads scriptURL; a postMessage spy also detects activation.
	return { scriptURL, postMessage: vi.fn() } as unknown as ServiceWorker;
}

function harness(sharedStorage = storage()) {
	const update = vi.fn<() => Promise<ServiceWorkerRegistration>>(() =>
		Promise.resolve({} as ServiceWorkerRegistration)
	);
	const registration = {
		scope: `${ORIGIN}/app/`,
		update,
		active: worker() as ServiceWorker | null,
		waiting: null as ServiceWorker | null,
		installing: null as ServiceWorker | null
	};
	let current: typeof registration | undefined = registration;
	const win = Object.assign(new EventTarget(), {
		location: {
			origin: ORIGIN,
			pathname: '/app/',
			reload: vi.fn()
		} as unknown as Location,
		localStorage: sharedStorage.api,
		navigator: { onLine: true, locks: undefined as LockManager | undefined }
	});
	const doc = Object.assign(new EventTarget(), {
		visibilityState: 'visible' as DocumentVisibilityState
	});
	const addWindowListener = vi.spyOn(win, 'addEventListener');
	const removeWindowListener = vi.spyOn(win, 'removeEventListener');
	const addDocumentListener = vi.spyOn(doc, 'addEventListener');
	const removeDocumentListener = vi.spyOn(doc, 'removeEventListener');
	return {
		storage: sharedStorage,
		win,
		doc,
		registration,
		update,
		addWindowListener,
		removeWindowListener,
		addDocumentListener,
		removeDocumentListener,
		setRegistration(next: typeof registration | undefined) {
			current = next;
		},
		start(now?: () => number) {
			const scheduler = createUpdateCheckScheduler(() => current, {
				window: win as unknown as SchedulerOptions['window'],
				document: doc,
				now
			});
			schedulers.push(scheduler);
			return scheduler;
		},
		emit(type: string) {
			win.dispatchEvent(new Event(type));
		},
		emitStorage(key: string | null = UPDATE_CHECK_STORAGE_KEY) {
			win.dispatchEvent(Object.assign(new Event('storage'), { key }));
		},
		setVisibility(state: DocumentVisibilityState) {
			doc.visibilityState = state;
			doc.dispatchEvent(new Event('visibilitychange'));
		}
	};
}

async function flush() {
	await vi.advanceTimersByTimeAsync(0);
}

function lockManager(
	request: (
		name: string,
		options: LockOptions,
		callback: (lock: Lock | null) => unknown
	) => Promise<unknown>
) {
	// This suite uses only request(name, { ifAvailable: true }, callback).
	const spy = vi.fn(request);
	return {
		api: { request: spy } as unknown as LockManager,
		request: spy
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(START);
});

afterEach(() => {
	for (const scheduler of schedulers.splice(0)) scheduler.dispose();
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('hourly update-check timing and persistence', () => {
	it('exports an hourly interval and a bounded thirty-second update timeout', () => {
		expect(UPDATE_CHECK_INTERVAL_MS).toBe(HOUR);
		expect(UPDATE_CHECK_TIMEOUT_MS).toBe(30_000);
	});

	it.each([
		['no timestamp', undefined],
		['a stale attempt', { lastAttemptAt: START - HOUR - 1 }],
		['an attempt exactly one hour old', { lastAttemptAt: START - HOUR }],
		['only a successful-check timestamp', { lastCheckedAt: START - 1 }]
	])('checks at startup with %s', async (_label, record) => {
		const h = harness();
		if (record !== undefined) h.storage.seed(record);
		h.start();
		expect(h.storage.record()?.lastAttemptAt).toBe(START);
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
		expect(h.storage.record()).toEqual({
			lastAttemptAt: START,
			lastCheckedAt: START
		});
	});

	it('waits only the remaining part of an hour after a recent attempt', async () => {
		const h = harness();
		h.storage.seed({ lastAttemptAt: START - HOUR + 5000 });
		h.start();
		await vi.advanceTimersByTimeAsync(4999);
		expect(h.update).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(h.update).toHaveBeenCalledOnce();
		expect(h.storage.record()).toEqual({
			lastAttemptAt: START + 5000,
			lastCheckedAt: START + 5000
		});
	});

	it('keeps checking once per hour while the app remains visible and online', async () => {
		const h = harness();
		h.start();
		await flush();
		await vi.advanceTimersByTimeAsync(HOUR - 1);
		expect(h.update).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);
		expect(h.update).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(HOUR);
		expect(h.update).toHaveBeenCalledTimes(3);
	});

	it('persists the attempt before update resolves and records success at resolution', async () => {
		const h = harness();
		const pending = deferred<ServiceWorkerRegistration>();
		h.update.mockReturnValue(pending.promise);
		h.start();
		expect(h.storage.record()).toEqual({ lastAttemptAt: START });
		await vi.advanceTimersByTimeAsync(250);
		pending.resolve({} as ServiceWorkerRegistration);
		await flush();
		expect(h.storage.record()).toEqual({
			lastAttemptAt: START,
			lastCheckedAt: START + 250
		});
	});

	it.each(['rejection', 'synchronous exception'])(
		'preserves the previous success and throttles a failed %s for one hour',
		async (failure) => {
			const h = harness();
			const previousSuccess = START - 2 * HOUR;
			h.storage.seed({
				lastAttemptAt: START - HOUR,
				lastCheckedAt: previousSuccess
			});
			if (failure === 'rejection')
				h.update.mockRejectedValue(new Error('Network unavailable'));
			else
				h.update.mockImplementation(() => {
					throw new Error('Update is not permitted');
				});
			h.start();
			await flush();
			expect(h.storage.record()).toEqual({
				lastAttemptAt: START,
				lastCheckedAt: previousSuccess
			});
			h.emit('focus');
			h.emit('online');
			await vi.advanceTimersByTimeAsync(HOUR - 1);
			expect(h.update).toHaveBeenCalledOnce();
			await vi.advanceTimersByTimeAsync(1);
			expect(h.update).toHaveBeenCalledTimes(2);
		}
	);

	it('uses the persisted attempt after disposal and recreation', async () => {
		const store = storage();
		const first = harness(store);
		const scheduler = first.start();
		await flush();
		scheduler.dispose();
		await vi.advanceTimersByTimeAsync(5000);
		const second = harness(store);
		second.start();
		await flush();
		expect(second.update).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(HOUR - 5000);
		expect(second.update).toHaveBeenCalledOnce();
		expect(first.update).toHaveBeenCalledOnce();
	});
});

describe('update-check eligibility and lifecycle events', () => {
	it('does not consume an attempt offline and checks immediately on reconnection', async () => {
		const h = harness();
		h.win.navigator.onLine = false;
		h.start();
		await vi.advanceTimersByTimeAsync(2 * HOUR);
		expect(h.update).not.toHaveBeenCalled();
		expect(h.storage.api.setItem).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		h.win.navigator.onLine = true;
		h.emit('online');
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
		expect(h.storage.record()?.lastAttemptAt).toBe(START + 2 * HOUR);
	});

	it('clears scheduled checks while offline and resumes only when due', async () => {
		const h = harness();
		h.start();
		await flush();
		h.win.navigator.onLine = false;
		h.emit('offline');
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(HOUR);
		expect(h.update).toHaveBeenCalledOnce();
		h.win.navigator.onLine = true;
		h.emit('online');
		await flush();
		expect(h.update).toHaveBeenCalledTimes(2);
	});

	it('skips hidden startup without a timestamp and checks on visibility resume', async () => {
		const h = harness();
		h.doc.visibilityState = 'hidden';
		h.start();
		await vi.advanceTimersByTimeAsync(HOUR);
		expect(h.storage.record()).toBeUndefined();
		expect(h.update).not.toHaveBeenCalled();
		h.setVisibility('visible');
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
		h.setVisibility('hidden');
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(HOUR);
		expect(h.update).toHaveBeenCalledOnce();
		h.setVisibility('visible');
		await flush();
		expect(h.update).toHaveBeenCalledTimes(2);
	});

	it.each(['focus', 'pageshow'])(
		'rechecks elapsed wall time on %s without duplicating a fresh check',
		async (event) => {
			const h = harness();
			h.start();
			await flush();
			h.emit(event);
			await flush();
			expect(h.update).toHaveBeenCalledOnce();
			vi.setSystemTime(START + 2 * HOUR);
			h.emit(event);
			await flush();
			expect(h.update).toHaveBeenCalledTimes(2);
		}
	);

	it('coalesces concurrent online, focus, pageshow, visibility and storage events', async () => {
		const h = harness();
		const pending = deferred<ServiceWorkerRegistration>();
		h.update.mockReturnValue(pending.promise);
		const scheduler = h.start();
		for (const event of ['online', 'focus', 'pageshow']) h.emit(event);
		h.setVisibility('visible');
		h.emitStorage();
		scheduler.refresh();
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
		pending.resolve({} as ServiceWorkerRegistration);
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(1);
	});

	it('does nothing until the intended registration exists', async () => {
		const h = harness();
		h.setRegistration(undefined);
		const scheduler = h.start();
		expect(h.update).not.toHaveBeenCalled();
		expect(h.storage.record()).toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
		h.setRegistration(h.registration);
		scheduler.refresh();
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
	});

	it.each(['/share/example', '/', '/app-other/', '/application/'])(
		'never checks from a non-app route: %s',
		async (pathname) => {
			const h = harness();
			h.win.location.pathname = pathname;
			h.start();
			h.emit('focus');
			await vi.advanceTimersByTimeAsync(2 * HOUR);
			expect(h.update).not.toHaveBeenCalled();
			expect(h.storage.record()).toBeUndefined();
		}
	);

	it.each([`${ORIGIN}/`, `${ORIGIN}/app-other/`, 'https://other.test/app/'])(
		'never checks an unintended registration scope: %s',
		async (scope) => {
			const h = harness();
			h.registration.scope = scope;
			h.start();
			await flush();
			expect(h.update).not.toHaveBeenCalled();
			expect(h.storage.record()).toBeUndefined();
		}
	);

	it.each(['active', 'waiting', 'installing'] as const)(
		'rejects a wrong newest %s script even when another worker is expected',
		async (newest) => {
			const h = harness();
			h.registration[newest] = worker(`${ORIGIN}/legacy-service-worker.js`);
			h.start();
			await flush();
			expect(h.update).not.toHaveBeenCalled();
			expect(h.storage.record()).toBeUndefined();
		}
	);

	it('uses installing before waiting and waiting before active for script ownership', async () => {
		const h = harness();
		h.registration.active = worker(`${ORIGIN}/legacy-service-worker.js`);
		h.registration.waiting = worker();
		h.start();
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
		const other = harness();
		other.registration.waiting = worker(`${ORIGIN}/legacy-service-worker.js`);
		other.registration.installing = worker();
		other.start();
		await flush();
		expect(other.update).toHaveBeenCalledOnce();
	});

	it('allows a correctly scoped initial registration before any worker is present', async () => {
		const h = harness();
		h.registration.active = null;
		h.start();
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
	});

	it('rejects the right script pathname from an unrelated origin', async () => {
		const h = harness();
		h.registration.active = worker('https://other.test/service-worker.js');
		h.start();
		await flush();
		expect(h.update).not.toHaveBeenCalled();
		expect(h.storage.record()).toBeUndefined();
	});

	it('never posts an activation message or reloads after a successful check', async () => {
		const h = harness();
		h.registration.waiting = worker();
		h.registration.installing = worker();
		h.start();
		await flush();
		await vi.advanceTimersByTimeAsync(HOUR);
		for (const sw of [
			h.registration.active,
			h.registration.waiting,
			h.registration.installing
		])
			expect(sw?.postMessage).not.toHaveBeenCalled();
		expect(h.win.location.reload).not.toHaveBeenCalled();
	});
});

describe('cross-tab coordination and blocked storage', () => {
	it('releases the claim lock before waiting for the network update', async () => {
		const h = harness();
		const pending = deferred<ServiceWorkerRegistration>();
		let held = false;
		const locks = lockManager(async (name, _options, callback) => {
			held = true;
			try {
				return callback({ name, mode: 'exclusive' });
			} finally {
				held = false;
			}
		});
		h.win.navigator.locks = locks.api;
		h.update.mockImplementation(() => {
			expect(held).toBe(false);
			return pending.promise;
		});
		h.start();
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
		expect(locks.request).toHaveBeenCalledOnce();
		expect(held).toBe(false);
		pending.resolve({} as ServiceWorkerRegistration);
		await flush();
		expect(locks.request).toHaveBeenCalledTimes(2);
		expect(h.storage.record()?.lastCheckedAt).toBe(START);
	});

	it('rechecks eligibility if the page becomes hidden before the claim lock arrives', async () => {
		const h = harness();
		const pending = deferred<void>();
		const locks = lockManager(async (name, _options, callback) => {
			await pending.promise;
			return callback({ name, mode: 'exclusive' });
		});
		h.win.navigator.locks = locks.api;
		h.start();
		h.setVisibility('hidden');
		pending.resolve();
		await flush();
		expect(h.update).not.toHaveBeenCalled();
		expect(h.storage.record()).toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
		h.setVisibility('visible');
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
	});

	it('keeps the hourly attempt throttle when the success-merge lock is unavailable', async () => {
		const h = harness();
		let requests = 0;
		const locks = lockManager(async (name, _options, callback) => {
			requests++;
			return callback(requests === 2 ? null : { name, mode: 'exclusive' });
		});
		h.win.navigator.locks = locks.api;
		h.start();
		await flush();
		expect(h.storage.record()).toEqual({ lastAttemptAt: START });
		await vi.advanceTimersByTimeAsync(HOUR - 1);
		expect(h.update).toHaveBeenCalledOnce();
		expect(locks.request).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(h.update).toHaveBeenCalledTimes(2);
		expect(h.storage.record()?.lastCheckedAt).toBe(START + HOUR);
	});

	it('deduplicates concurrent tabs under one shared Web Lock', async () => {
		const store = storage();
		let held = false;
		const locks = lockManager(async (name, options, callback) => {
			expect(name).toBe(UPDATE_CHECK_STORAGE_KEY);
			expect(options).toEqual({ ifAvailable: true });
			if (held) return callback(null);
			held = true;
			await Promise.resolve();
			try {
				return callback({ name, mode: 'exclusive' });
			} finally {
				held = false;
			}
		});
		const first = harness(store);
		const second = harness(store);
		first.win.navigator.locks = locks.api;
		second.win.navigator.locks = locks.api;
		first.start();
		second.start();
		await flush();
		// Two concurrent claims, plus one short lock to merge the successful check.
		expect(locks.request).toHaveBeenCalledTimes(3);
		expect(
			first.update.mock.calls.length + second.update.mock.calls.length
		).toBe(1);
		await vi.advanceTimersByTimeAsync(HOUR);
		expect(
			first.update.mock.calls.length + second.update.mock.calls.length
		).toBe(2);
	});

	it('retries a contended lock after a bounded delay rather than spinning or checking unlocked', async () => {
		const h = harness();
		let grant = false;
		const locks = lockManager(async (name, _options, callback) =>
			callback(grant ? { name, mode: 'exclusive' } : null)
		);
		h.win.navigator.locks = locks.api;
		h.start();
		await flush();
		expect(locks.request).toHaveBeenCalledOnce();
		expect(h.update).not.toHaveBeenCalled();
		expect(h.storage.record()).toBeUndefined();
		for (const event of ['focus', 'pageshow', 'online']) h.emit(event);
		await vi.advanceTimersByTimeAsync(59_999);
		expect(locks.request).toHaveBeenCalledOnce();
		grant = true;
		await vi.advanceTimersByTimeAsync(1);
		// The successful retry also takes a short lock to merge its result.
		expect(locks.request).toHaveBeenCalledTimes(3);
		expect(h.update).toHaveBeenCalledOnce();
	});

	it.each(['rejection', 'synchronous exception', 'throwing getter'])(
		'falls back to the hourly storage throttle after a Locks API %s',
		async (failure) => {
			const h = harness();
			const unavailable = vi.fn(() => {
				throw new Error('Web Locks are blocked in this browser');
			});
			const locks = lockManager(
				failure === 'rejection' ? async () => unavailable() : unavailable
			);
			if (failure === 'throwing getter')
				Object.defineProperty(h.win.navigator, 'locks', { get: unavailable });
			else h.win.navigator.locks = locks.api;
			h.start();
			await flush();
			expect(unavailable).toHaveBeenCalledOnce();
			expect(h.update).toHaveBeenCalledOnce();
			expect(h.storage.record()).toEqual({
				lastAttemptAt: START,
				lastCheckedAt: START
			});
			for (const event of ['focus', 'pageshow', 'online']) h.emit(event);
			await vi.advanceTimersByTimeAsync(HOUR - 1);
			expect(h.update).toHaveBeenCalledOnce();
			expect(unavailable).toHaveBeenCalledOnce();
			await vi.advanceTimersByTimeAsync(1);
			expect(h.update).toHaveBeenCalledTimes(2);
			expect(unavailable).toHaveBeenCalledOnce();
		}
	);

	it('does not repeat a claim if the Locks API rejects after running its callback', async () => {
		const h = harness();
		const locks = lockManager(async (name, _options, callback) => {
			callback({ name, mode: 'exclusive' });
			throw new Error('The lock failed after the callback ran');
		});
		h.win.navigator.locks = locks.api;
		h.start();
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
		// One claim write and one successful-completion write, with no repeated claim.
		expect(h.storage.api.setItem).toHaveBeenCalledTimes(2);
		expect(locks.request).toHaveBeenCalledTimes(2);
		expect(h.storage.record()).toEqual({
			lastAttemptAt: START,
			lastCheckedAt: START
		});
	});

	it('does not rerun a throwing claim outside its lock', async () => {
		const h = harness();
		let scopeReads = 0;
		Object.defineProperty(h.registration, 'scope', {
			get() {
				scopeReads++;
				// Initial eligibility succeeds, but the claim's own recheck fails.
				if (scopeReads === 2)
					throw new Error('Registration became unavailable');
				return `${ORIGIN}/app/`;
			}
		});
		const locks = lockManager(async (name, _options, callback) =>
			callback({ name, mode: 'exclusive' })
		);
		h.win.navigator.locks = locks.api;
		h.start();
		await flush();
		expect(locks.request).toHaveBeenCalledOnce();
		expect(h.update).not.toHaveBeenCalled();
		expect(h.storage.record()).toBeUndefined();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(h.update).toHaveBeenCalledOnce();
		expect(locks.request).toHaveBeenCalledTimes(3);
	});

	it('uses the shared timestamp as best-effort deduplication without Web Locks', async () => {
		const store = storage();
		const first = harness(store);
		const second = harness(store);
		first.start();
		second.start();
		await flush();
		expect(first.update).toHaveBeenCalledOnce();
		expect(second.update).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(HOUR);
		expect(
			first.update.mock.calls.length + second.update.mock.calls.length
		).toBe(2);
	});

	it.each(['read', 'write', 'both'])(
		'keeps an in-memory hourly throttle when storage %s is blocked',
		async (blocked) => {
			const h = harness();
			h.storage.seed({ lastAttemptAt: START - HOUR });
			const deny = () => {
				throw new Error('Storage permission denied');
			};
			if (blocked !== 'write') h.storage.api.getItem.mockImplementation(deny);
			if (blocked !== 'read') h.storage.api.setItem.mockImplementation(deny);
			h.start();
			await flush();
			h.emit('focus');
			h.emit('online');
			h.emitStorage();
			await vi.advanceTimersByTimeAsync(HOUR - 1);
			expect(h.update).toHaveBeenCalledOnce();
			await vi.advanceTimersByTimeAsync(1);
			expect(h.update).toHaveBeenCalledTimes(2);
		}
	);

	it.each([UPDATE_CHECK_STORAGE_KEY, null])(
		'reschedules after a relevant cross-tab storage change (%s)',
		async (key) => {
			const h = harness();
			h.start();
			await flush();
			await vi.advanceTimersByTimeAsync(HOUR / 2);
			h.storage.seed({ lastAttemptAt: START + HOUR / 2 });
			h.emitStorage(key);
			await vi.advanceTimersByTimeAsync(HOUR - 1);
			expect(h.update).toHaveBeenCalledOnce();
			await vi.advanceTimersByTimeAsync(1);
			expect(h.update).toHaveBeenCalledTimes(2);
		}
	);

	it('ignores unrelated storage events', async () => {
		const h = harness();
		h.start();
		await flush();
		h.storage.api.getItem.mockClear();
		h.emitStorage('unrelated:preference');
		expect(h.storage.api.getItem).not.toHaveBeenCalled();
		expect(h.update).toHaveBeenCalledOnce();
	});
});

describe('invalid timestamps and wall-clock changes', () => {
	it.each([
		'{not json',
		'null',
		'[]',
		'"not a record"',
		'{}',
		JSON.stringify({ lastAttemptAt: 'yesterday' }),
		JSON.stringify({ lastAttemptAt: null }),
		JSON.stringify({ lastAttemptAt: 0 }),
		JSON.stringify({ lastAttemptAt: -1 }),
		JSON.stringify({ lastAttemptAt: START + HOUR }),
		'{"lastAttemptAt":1e999}'
	])('repairs malformed or unusable persisted timestamps: %s', async (raw) => {
		const h = harness();
		h.storage.seedRaw(raw);
		h.start();
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
		expect(h.storage.record()).toEqual({
			lastAttemptAt: START,
			lastCheckedAt: START
		});
	});

	it('drops a future success timestamp instead of preserving it on failure', async () => {
		const h = harness();
		h.storage.seed({
			lastAttemptAt: START - HOUR,
			lastCheckedAt: START + HOUR
		});
		h.update.mockRejectedValue(new Error('Network unavailable'));
		h.start();
		await flush();
		expect(h.storage.record()).toEqual({ lastAttemptAt: START });
	});

	it('repairs a formerly valid timestamp after a backwards wall-clock jump', async () => {
		const h = harness();
		h.start();
		await flush();
		vi.setSystemTime(START - HOUR);
		h.emit('focus');
		await flush();
		expect(h.update).toHaveBeenCalledTimes(2);
		expect(h.storage.record()).toEqual({
			lastAttemptAt: START - HOUR,
			lastCheckedAt: START - HOUR
		});
		await vi.advanceTimersByTimeAsync(HOUR - 1);
		expect(h.update).toHaveBeenCalledTimes(2);
	});

	it('does not extend a denied-lock retry indefinitely after a backwards clock jump', async () => {
		const h = harness();
		let grant = false;
		const locks = lockManager(async (name, _options, callback) =>
			callback(grant ? { name, mode: 'exclusive' } : null)
		);
		h.win.navigator.locks = locks.api;
		h.start();
		await flush();
		expect(locks.request).toHaveBeenCalledOnce();
		vi.setSystemTime(START - HOUR);
		grant = true;
		h.emit('focus');
		await flush();
		expect(h.update).toHaveBeenCalledOnce();
		expect(h.storage.record()?.lastAttemptAt).toBe(START - HOUR);
	});

	it('uses the injected clock for attempt and successful-check timestamps', async () => {
		const h = harness();
		let time = START + HOUR;
		const pending = deferred<ServiceWorkerRegistration>();
		h.update.mockReturnValue(pending.promise);
		h.start(() => time);
		expect(h.storage.record()).toEqual({ lastAttemptAt: time });
		time += 321;
		pending.resolve({} as ServiceWorkerRegistration);
		await flush();
		expect(h.storage.record()).toEqual({
			lastAttemptAt: START + HOUR,
			lastCheckedAt: START + HOUR + 321
		});
	});
});

describe('update timeouts, stale results and disposal', () => {
	it('times out a hung update, ignores late success, and retries at the hourly boundary', async () => {
		const h = harness();
		const pending = deferred<ServiceWorkerRegistration>();
		h.update.mockReturnValueOnce(pending.promise);
		h.storage.seed({
			lastAttemptAt: START - HOUR,
			lastCheckedAt: START - 2 * HOUR
		});
		h.start();
		await vi.advanceTimersByTimeAsync(UPDATE_CHECK_TIMEOUT_MS);
		expect(h.storage.record()).toEqual({
			lastAttemptAt: START,
			lastCheckedAt: START - 2 * HOUR
		});
		expect(vi.getTimerCount()).toBe(1);
		pending.resolve({} as ServiceWorkerRegistration);
		await flush();
		expect(h.storage.record()?.lastCheckedAt).toBe(START - 2 * HOUR);
		await vi.advanceTimersByTimeAsync(HOUR - UPDATE_CHECK_TIMEOUT_MS - 1);
		expect(h.update).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);
		expect(h.update).toHaveBeenCalledTimes(2);
		expect(h.storage.record()).toEqual({
			lastAttemptAt: START + HOUR,
			lastCheckedAt: START + HOUR
		});
	});

	it('does not overwrite a newer tab attempt when an older update resolves', async () => {
		const h = harness();
		const pending = deferred<ServiceWorkerRegistration>();
		h.update.mockReturnValue(pending.promise);
		h.start();
		await vi.advanceTimersByTimeAsync(1000);
		const newer = {
			lastAttemptAt: START + 1000,
			lastCheckedAt: START + 500
		};
		h.storage.seed(newer);
		h.emitStorage();
		pending.resolve({} as ServiceWorkerRegistration);
		await flush();
		expect(h.storage.record()).toEqual(newer);
	});

	it('never lets a timed-out old request replace a later successful attempt', async () => {
		const h = harness();
		const old = deferred<ServiceWorkerRegistration>();
		h.update.mockReturnValueOnce(old.promise);
		h.start();
		await vi.advanceTimersByTimeAsync(HOUR);
		expect(h.update).toHaveBeenCalledTimes(2);
		const latest = h.storage.record();
		await vi.advanceTimersByTimeAsync(1000);
		old.resolve({} as ServiceWorkerRegistration);
		await flush();
		expect(h.storage.record()).toEqual(latest);
	});

	it('removes all event listeners and timers on disposal', async () => {
		const h = harness();
		const scheduler = h.start();
		await flush();
		expect(h.addWindowListener.mock.calls.map(([type]) => type)).toEqual([
			'online',
			'offline',
			'focus',
			'pageshow',
			'storage'
		]);
		expect(h.addDocumentListener).toHaveBeenCalledExactlyOnceWith(
			'visibilitychange',
			expect.any(Function)
		);
		expect(vi.getTimerCount()).toBe(1);
		scheduler.dispose();
		expect(vi.getTimerCount()).toBe(0);
		for (const [type, listener] of h.addWindowListener.mock.calls)
			expect(h.removeWindowListener).toHaveBeenCalledWith(type, listener);
		for (const [type, listener] of h.addDocumentListener.mock.calls)
			expect(h.removeDocumentListener).toHaveBeenCalledWith(type, listener);
		for (const event of ['online', 'offline', 'focus', 'pageshow'])
			h.emit(event);
		h.setVisibility('visible');
		h.emitStorage();
		scheduler.refresh();
		await vi.advanceTimersByTimeAsync(2 * HOUR);
		expect(h.update).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('cancels a pending timeout and ignores update completion after disposal', async () => {
		const h = harness();
		const pending = deferred<ServiceWorkerRegistration>();
		h.update.mockReturnValue(pending.promise);
		const scheduler = h.start();
		await flush();
		expect(vi.getTimerCount()).toBe(1);
		scheduler.dispose();
		await flush();
		expect(vi.getTimerCount()).toBe(0);
		pending.resolve({} as ServiceWorkerRegistration);
		await flush();
		expect(h.storage.record()).toEqual({ lastAttemptAt: START });
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not start an update when a pending Web Lock arrives after disposal', async () => {
		const h = harness();
		const pending = deferred<void>();
		const locks = lockManager(async (name, _options, callback) => {
			await pending.promise;
			return callback({ name, mode: 'exclusive' });
		});
		h.win.navigator.locks = locks.api;
		const scheduler = h.start();
		scheduler.dispose();
		pending.resolve();
		await flush();
		expect(h.update).not.toHaveBeenCalled();
		expect(h.storage.record()).toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
	});
});
