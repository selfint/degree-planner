import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEntryUpdate, isAppUpdateRegistration } from './entry-update';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => (resolve = yes));
	return { promise, resolve };
}
function harness() {
	const worker = Object.assign(new EventTarget(), { state: 'installed' });
	const registration = {
		waiting: worker,
		active: {},
		installing: null
	} as unknown as {
		-readonly [K in keyof ServiceWorkerRegistration]: ServiceWorkerRegistration[K];
	};
	const finished = vi.fn();
	const failed = vi.fn();
	const check = vi.fn().mockResolvedValue(undefined);
	const activate = vi.fn().mockResolvedValue(undefined);
	const readVersion = vi.fn().mockResolvedValue('v2');
	const entry = createEntryUpdate({
		finished,
		failed,
		currentVersion: 'v1',
		readVersion
	});
	return {
		worker,
		registration,
		finished,
		failed,
		check,
		activate,
		readVersion,
		entry,
		run: () => entry.run(registration, check, activate)
	};
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('fresh app entry update boundary', () => {
	it('applies an existing waiting update without network and releases the gate once', async () => {
		const h = harness();
		await h.run();
		await h.run();
		expect(h.check).not.toHaveBeenCalled();
		expect(h.activate).toHaveBeenCalledExactlyOnceWith(h.worker, 'v2');
		expect(h.finished).toHaveBeenCalledOnce();
	});
	it('checks once then ends entry when there is no update; later updates are manual', async () => {
		const h = harness();
		h.registration.waiting = null;
		await h.run();
		h.registration.waiting = h.worker as unknown as ServiceWorker;
		await h.run();
		expect(h.check).toHaveBeenCalledOnce();
		expect(h.activate).not.toHaveBeenCalled();
	});
	it('waits for a newly discovered update to install before activation', async () => {
		const h = harness();
		h.registration.waiting = null;
		h.worker.state = 'installing';
		h.registration.installing = h.worker as unknown as ServiceWorker;
		const done = h.run();
		await vi.advanceTimersByTimeAsync(0);
		expect(h.activate).not.toHaveBeenCalled();
		expect(h.finished).not.toHaveBeenCalled();
		h.worker.state = 'installed';
		h.registration.waiting = h.worker as unknown as ServiceWorker;
		h.worker.dispatchEvent(new Event('statechange'));
		await done;
		expect(h.activate).toHaveBeenCalledOnce();
	});
	it('finishes offline/no update without requiring a network request', async () => {
		const h = harness();
		h.registration.waiting = null;
		await h.run();
		expect(h.finished).toHaveBeenCalledOnce();
		expect(h.activate).not.toHaveBeenCalled();
	});
	it('releases a hung registration boundary and never starts late work', async () => {
		const h = harness();
		await vi.advanceTimersByTimeAsync(30_000);
		await h.run();
		expect(h.failed).toHaveBeenCalledOnce();
		expect(h.finished).toHaveBeenCalledOnce();
		expect(h.readVersion).not.toHaveBeenCalled();
	});
	it('a timed-out version reply cannot reload an already editable session', async () => {
		const h = harness();
		const reply = deferred<string>();
		h.readVersion.mockReturnValue(reply.promise);
		const done = h.run();
		await vi.advanceTimersByTimeAsync(30_000);
		reply.resolve('v2');
		await done;
		expect(h.activate).not.toHaveBeenCalled();
		expect(h.finished).toHaveBeenCalledOnce();
	});
	it('a late network update cannot automatically activate after detection timeout', async () => {
		const h = harness();
		h.registration.waiting = null;
		const reply = deferred<void>();
		h.check.mockReturnValue(reply.promise);
		const done = h.run();
		await vi.advanceTimersByTimeAsync(30_000);
		h.registration.waiting = h.worker as unknown as ServiceWorker;
		reply.resolve();
		await done;
		expect(h.activate).not.toHaveBeenCalled();
	});
	it('removes installation listener at timeout and treats eventual completion as mid-session', async () => {
		const h = harness();
		h.registration.waiting = null;
		h.worker.state = 'installing';
		h.registration.installing = h.worker as unknown as ServiceWorker;
		const remove = vi.spyOn(h.worker, 'removeEventListener');
		const done = h.run();
		await vi.advanceTimersByTimeAsync(30_000);
		await done;
		expect(remove).toHaveBeenCalled();
		expect(h.activate).not.toHaveBeenCalled();
	});
	it('keeps editing gated until bounded activation settles, even beyond detection timeout', async () => {
		const h = harness();
		const reply = deferred<void>();
		h.activate.mockReturnValue(reply.promise);
		const done = h.run();
		await vi.advanceTimersByTimeAsync(30_000);
		expect(h.finished).not.toHaveBeenCalled();
		reply.resolve();
		await done;
		expect(h.finished).toHaveBeenCalledOnce();
	});
	it('never activates a superseded worker or reloads an identical build', async () => {
		const h = harness();
		h.readVersion.mockResolvedValue('v1');
		await h.run();
		expect(h.activate).not.toHaveBeenCalled();
		const other = harness();
		other.readVersion.mockImplementation(async () => {
			other.registration.waiting = null;
			return 'v2';
		});
		await other.run();
		expect(other.activate).not.toHaveBeenCalled();
	});
	it('reports errors and releases startup rather than trapping the user', async () => {
		const h = harness();
		h.readVersion.mockRejectedValue(new Error('invalid reply'));
		await h.run();
		expect(h.failed).toHaveBeenCalledOnce();
		expect(h.finished).toHaveBeenCalledOnce();
	});
	it('disposal prevents late activation', async () => {
		const h = harness();
		const reply = deferred<string>();
		h.readVersion.mockReturnValue(reply.promise);
		const done = h.run();
		h.entry.finish();
		reply.resolve('v2');
		await done;
		expect(h.activate).not.toHaveBeenCalled();
	});
});

describe('registration ownership', () => {
	it('rejects legacy root registrations and unrelated scripts offline too', () => {
		const h = harness();
		Object.assign(h.registration, {
			scope: 'https://planit.test/',
			active: null,
			waiting: { scriptURL: 'https://planit.test/service-worker.js' }
		});
		expect(isAppUpdateRegistration(h.registration, 'https://planit.test')).toBe(
			false
		);
		Object.assign(h.registration, { scope: 'https://planit.test/app/' });
		expect(isAppUpdateRegistration(h.registration, 'https://planit.test')).toBe(
			true
		);
		Object.assign(h.registration, {
			waiting: { scriptURL: 'https://planit.test/other.js' }
		});
		expect(isAppUpdateRegistration(h.registration, 'https://planit.test')).toBe(
			false
		);
	});
});
