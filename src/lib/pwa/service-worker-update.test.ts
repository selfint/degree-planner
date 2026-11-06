import { describe, expect, it, vi } from 'vitest';
import {
	createUpdateVersionReader,
	hasWaitingUpdate,
	readWaitingWorkerVersion,
	replacesExistingWorker
} from './service-worker-update';

describe('service worker update notification', () => {
	it('does not announce the initial installation as an update', () => {
		expect(replacesExistingWorker({}, null, null)).toBe(false);
	});
	it('does not announce a first installation that already claimed the page', () => {
		const firstWorker = {};
		expect(replacesExistingWorker(firstWorker, firstWorker, firstWorker)).toBe(
			false
		);
	});
	it('recognizes an update of an active worker even before it controls the page', () => {
		expect(replacesExistingWorker({}, {}, null)).toBe(true);
	});
	it('recognizes an update of the worker controlling an open draft', () => {
		expect(replacesExistingWorker({}, null, {})).toBe(true);
	});
});

describe('waiting worker version protocol', () => {
	function workerReply(reply: unknown): Pick<ServiceWorker, 'postMessage'> {
		return {
			postMessage(message, transfer) {
				expect(message).toEqual({ type: 'GET_OFFLINE_SHELL_VERSION' });
				const port = (transfer as Transferable[])[0] as MessagePort;
				port.postMessage(reply);
			}
		};
	}

	it('reads the contacted worker version without requesting activation', async () => {
		expect(
			await readWaitingWorkerVersion(
				workerReply({ type: 'OFFLINE_SHELL_VERSION', version: 'build-v2' })
			)
		).toBe('build-v2');
	});

	it.each([
		null,
		{},
		{ type: 'OFFLINE_SHELL_STATUS', version: 'wrong-protocol' },
		{ type: 'OFFLINE_SHELL_VERSION', version: 2 },
		{ type: 'OFFLINE_SHELL_VERSION', version: '' },
		{ type: 'OFFLINE_SHELL_VERSION', version: '   ' }
	])(
		'rejects invalid version replies without inventing a fallback: %j',
		async (reply) => {
			await expect(
				readWaitingWorkerVersion(workerReply(reply))
			).rejects.toThrow('invalid version response');
		}
	);

	it('reports a bounded timeout for a worker without this protocol', async () => {
		await expect(
			readWaitingWorkerVersion({ postMessage() {} }, 5)
		).rejects.toThrow('Timed out waiting for the update version.');
	});

	it('preserves the actual transport failure', async () => {
		await expect(
			readWaitingWorkerVersion({
				postMessage() {
					throw new Error('Worker transport denied');
				}
			})
		).rejects.toThrow('Worker transport denied');
	});
});

describe('waiting worker version ownership', () => {
	function deferred() {
		let resolve!: (value: string) => void;
		let reject!: (error: Error) => void;
		const promise = new Promise<string>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		return { promise, resolve, reject };
	}
	const worker = (): Pick<ServiceWorker, 'postMessage'> => ({
		postMessage() {}
	});

	it('queries once per worker, including after successful ordinary reconciliations', async () => {
		const waiting = worker();
		const publish = vi.fn();
		const read = vi.fn().mockResolvedValue('v2');
		const reader = createUpdateVersionReader(() => waiting, publish, read);
		reader.reconcile();
		reader.reconcile();
		await Promise.resolve();
		reader.reconcile();
		expect(read).toHaveBeenCalledExactlyOnceWith(waiting);
		expect(publish.mock.calls).toEqual([[{}], [{ version: 'v2' }]]);
	});

	it('reports a failure without silently retrying or manufacturing a version', async () => {
		const waiting = worker();
		const publish = vi.fn();
		const read = vi
			.fn()
			.mockRejectedValue(new Error('Version reply timed out'));
		const reader = createUpdateVersionReader(() => waiting, publish, read);
		reader.reconcile();
		await Promise.resolve();
		reader.reconcile();
		expect(read).toHaveBeenCalledOnce();
		expect(publish.mock.calls).toEqual([
			[{}],
			[{ error: 'Version reply timed out' }]
		]);
	});

	it('keeps an empty transport failure visible', async () => {
		const waiting = worker();
		const publish = vi.fn();
		const reader = createUpdateVersionReader(
			() => waiting,
			publish,
			async () => {
				throw new Error('');
			}
		);
		reader.reconcile();
		await Promise.resolve();
		expect(publish).toHaveBeenLastCalledWith({
			error: 'The update version could not be verified.'
		});
	});

	it.each(['resolve', 'reject'] as const)(
		'ignores an older worker %s after a newer worker becomes ready',
		async (completion) => {
			const oldReply = deferred();
			const newReply = deferred();
			let waiting = worker();
			const publish = vi.fn();
			const read = vi
				.fn()
				.mockReturnValueOnce(oldReply.promise)
				.mockReturnValueOnce(newReply.promise);
			const reader = createUpdateVersionReader(() => waiting, publish, read);
			reader.reconcile();
			waiting = worker();
			reader.reconcile();
			newReply.resolve('v3');
			await Promise.resolve();
			if (completion === 'resolve') oldReply.resolve('v2');
			else oldReply.reject(new Error('Old worker failed'));
			await Promise.resolve();
			expect(publish.mock.calls).toEqual([[{}], [{}], [{ version: 'v3' }]]);
		}
	);

	it('checks the live waiting worker even before its next lifecycle callback', async () => {
		const reply = deferred();
		let waiting = worker();
		const publish = vi.fn();
		const reader = createUpdateVersionReader(
			() => waiting,
			publish,
			() => reply.promise
		);
		reader.reconcile();
		waiting = worker();
		reply.resolve('old-version');
		await Promise.resolve();
		expect(publish.mock.calls).toEqual([[{}]]);
	});

	it('clears a verified version after activation or removal of the waiting worker', async () => {
		let waiting: Pick<ServiceWorker, 'postMessage'> | null = worker();
		const publish = vi.fn();
		const reader = createUpdateVersionReader(
			() => waiting,
			publish,
			async () => 'v2'
		);
		reader.reconcile();
		await Promise.resolve();
		waiting = null;
		reader.reconcile();
		expect(publish.mock.calls).toEqual([[{}], [{ version: 'v2' }], [{}]]);
	});

	it('ignores completion after disposal', async () => {
		const reply = deferred();
		const waiting = worker();
		const publish = vi.fn();
		const reader = createUpdateVersionReader(
			() => waiting,
			publish,
			() => reply.promise
		);
		reader.reconcile();
		reader.dispose();
		reply.resolve('v2');
		await Promise.resolve();
		reader.reconcile();
		expect(publish.mock.calls).toEqual([[{}]]);
	});
});

describe('waiting update readiness', () => {
	const installed = () => ({ state: 'installed' as ServiceWorkerState });

	it('requires an installed waiting replacement', () => {
		expect(hasWaitingUpdate(installed(), {})).toBe(true);
		expect(hasWaitingUpdate(null, {})).toBe(false);
	});

	it('does not announce the first install before or after it claims the page', () => {
		const firstWorker = installed();
		expect(hasWaitingUpdate(firstWorker, null)).toBe(false);
		expect(hasWaitingUpdate(firstWorker, firstWorker)).toBe(false);
	});

	it.each<ServiceWorkerState>([
		'parsed',
		'installing',
		'activating',
		'activated',
		'redundant'
	])('does not announce a %s worker as ready', (state) => {
		expect(hasWaitingUpdate({ state }, {})).toBe(false);
	});

	it('clears readiness as a waiting replacement activates or is discarded', () => {
		const waiting = installed();
		const active = {};
		expect(hasWaitingUpdate(waiting, active)).toBe(true);
		waiting.state = 'activating';
		expect(hasWaitingUpdate(waiting, active)).toBe(false);
		expect(hasWaitingUpdate(null, waiting)).toBe(false);
		waiting.state = 'redundant';
		expect(hasWaitingUpdate(waiting, active)).toBe(false);
	});

	it('uses current registration state when an older worker event arrives', () => {
		const oldWaiting = installed();
		const registration = { active: {}, waiting: oldWaiting };
		expect(hasWaitingUpdate(registration.waiting, registration.active)).toBe(
			true
		);
		registration.waiting = installed();
		oldWaiting.state = 'redundant';
		// A listener on oldWaiting must reconcile from the current registration.
		expect(hasWaitingUpdate(registration.waiting, registration.active)).toBe(
			true
		);
	});
});
