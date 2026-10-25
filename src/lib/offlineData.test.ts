import { beforeEach, describe, expect, it, vi } from 'vitest';
const prepare = vi.hoisted(() => vi.fn());
const readiness = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => ({
	error: undefined as string | undefined,
	listeners: new Set<() => void>()
}));
function reportRefreshError(error?: string) {
	refresh.error = error;
	for (const listener of refresh.listeners) listener();
}
vi.mock('./publicData', () => ({
	preparePublicCourseData: prepare,
	readPublicCourseDataReadiness: readiness,
	readPublicDataRefreshError: () => refresh.error,
	subscribePublicDataRefreshErrors: (listener: () => void) => {
		refresh.listeners.add(listener);
		listener();
		return () => refresh.listeners.delete(listener);
	}
}));
beforeEach(() => {
	vi.resetModules();
	prepare.mockReset();
	refresh.error = undefined;
	refresh.listeners.clear();
	readiness.mockReset().mockResolvedValue({ ready: false, courseCount: 0 });
});
describe('offline course readiness', () => {
	it('does not mark partial or non-durable downloads ready', async () => {
		prepare.mockResolvedValue({ ready: false, courseCount: 30 });
		const { prepareOfflinePublicData, subscribeOfflinePublicData } =
			await import('./offlineData');
		const states: string[] = [];
		const unsubscribe = subscribeOfflinePublicData((state) =>
			states.push(state.phase)
		);
		expect((await prepareOfflinePublicData()).phase).toBe('error');
		expect(states).toEqual(['idle', 'loading', 'error']);
		unsubscribe();
	});
	it('deduplicates preparation and reports the complete stored course count', async () => {
		let finish!: (result: unknown) => void;
		prepare.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const { prepareOfflinePublicData } = await import('./offlineData');
		const first = prepareOfflinePublicData();
		expect(prepareOfflinePublicData()).toBe(first);
		finish({ ready: true, courseCount: 3362 });
		expect(await first).toEqual({ phase: 'ready', courseCount: 3362 });
		expect(prepare).toHaveBeenCalledTimes(1);
	});
	it('can retry after storage or network failure without false readiness', async () => {
		prepare
			.mockRejectedValueOnce(new Error('failed'))
			.mockResolvedValueOnce({ ready: true, courseCount: 200 });
		const { prepareOfflinePublicData } = await import('./offlineData');
		expect((await prepareOfflinePublicData()).phase).toBe('error');
		expect((await prepareOfflinePublicData()).phase).toBe('ready');
	});
});

describe('cached console bootstrap', () => {
	it('returns verified cached readiness while refresh is stalled, without a loading-state flicker', async () => {
		readiness.mockResolvedValue({ ready: true, courseCount: 3362 });
		prepare.mockReturnValue(new Promise(() => {}));
		const { bootstrapOfflinePublicData, subscribeOfflinePublicData } =
			await import('./offlineData');
		const states: string[] = [];
		const unsubscribe = subscribeOfflinePublicData((state) =>
			states.push(state.phase)
		);
		expect(await bootstrapOfflinePublicData()).toEqual({
			phase: 'ready',
			courseCount: 3362
		});
		await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce());
		expect(states).toEqual(['idle', 'ready']);
		unsubscribe();
	}, 250);
	it('still waits for the initial complete download on a cold or partial cache', async () => {
		let finish!: (value: unknown) => void;
		prepare.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const { bootstrapOfflinePublicData } = await import('./offlineData');
		let settled = false;
		const opening = bootstrapOfflinePublicData().then((state) => {
			settled = true;
			return state;
		});
		await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce());
		expect(settled).toBe(false);
		finish({ ready: true, courseCount: 3362 });
		expect((await opening).phase).toBe('ready');
	});
});

it('revokes ready when a later refresh discovers evicted durable data', async () => {
	prepare.mockResolvedValueOnce({ ready: true, courseCount: 3362 });
	const { prepareOfflinePublicData, subscribeOfflinePublicData } =
		await import('./offlineData');
	await prepareOfflinePublicData();
	const states: string[] = [];
	const unsubscribe = subscribeOfflinePublicData((state) =>
		states.push(state.phase)
	);
	readiness.mockResolvedValue({ ready: false, courseCount: 0 });
	prepare.mockReturnValue(new Promise(() => {}));
	void prepareOfflinePublicData();
	await vi.waitFor(() => expect(states).toEqual(['ready', 'loading']));
	unsubscribe();
});

it('does not let successful core refresh erase a selected-degree failure', async () => {
	readiness.mockResolvedValue({ ready: true, courseCount: 3362 });
	prepare.mockResolvedValue({
		ready: true,
		courseCount: 3362,
		refreshed: true
	});
	const { prepareOfflinePublicData } = await import('./offlineData');
	reportRefreshError('Invalid public data: /selected/requirementsData.json');
	expect(await prepareOfflinePublicData()).toEqual({
		phase: 'ready',
		courseCount: 3362,
		refreshError: 'Invalid public data: /selected/requirementsData.json'
	});
	// Only the common source's successful refresh of that URL clears its failure.
	reportRefreshError();
	expect(await prepareOfflinePublicData()).toEqual({
		phase: 'ready',
		courseCount: 3362
	});
});

it('reports a cold invalid download as an error rather than cached readiness', async () => {
	reportRefreshError('Invalid public data: /courseData.json');
	prepare.mockResolvedValue({ ready: false, courseCount: 0 });
	const { prepareOfflinePublicData } = await import('./offlineData');
	expect(await prepareOfflinePublicData()).toEqual({
		phase: 'error',
		courseCount: 0,
		error: 'Invalid public data: /courseData.json',
		refreshError: 'Invalid public data: /courseData.json'
	});
});

it('preserves a known refresh error during a later cached bootstrap', async () => {
	readiness.mockResolvedValue({ ready: true, courseCount: 3362 });
	reportRefreshError('Invalid public data: /courseData.json');
	const { bootstrapOfflinePublicData } = await import('./offlineData');
	prepare.mockReturnValue(new Promise(() => {}));
	expect(await bootstrapOfflinePublicData()).toEqual({
		phase: 'ready',
		courseCount: 3362,
		refreshError: 'Invalid public data: /courseData.json'
	});
});

it('retains the refresh failure across a transient missing-cache check without a successful retry', async () => {
	reportRefreshError('Refresh rejected');
	prepare.mockResolvedValue({ ready: true, courseCount: 3362 });
	const { prepareOfflinePublicData } = await import('./offlineData');
	await prepareOfflinePublicData();
	readiness.mockResolvedValue({ ready: false, courseCount: 0 });
	expect(await prepareOfflinePublicData()).toEqual({
		phase: 'ready',
		courseCount: 3362,
		refreshError: 'Refresh rejected'
	});
});

it('immediately exposes later background failures and safely releases the shared subscription', async () => {
	prepare.mockResolvedValue({ ready: true, courseCount: 3362 });
	const { prepareOfflinePublicData, subscribeOfflinePublicData } =
		await import('./offlineData');
	await prepareOfflinePublicData();
	const listener = vi.fn();
	const unsubscribe = subscribeOfflinePublicData(listener);
	expect(listener).toHaveBeenLastCalledWith({
		phase: 'ready',
		courseCount: 3362
	});
	reportRefreshError('Selected degree refresh rejected');
	expect(listener).toHaveBeenLastCalledWith({
		phase: 'ready',
		courseCount: 3362,
		refreshError: 'Selected degree refresh rejected'
	});
	unsubscribe();
	expect(refresh.listeners.size).toBe(0);
	const calls = listener.mock.calls.length;
	reportRefreshError('A later selected degree failure');
	expect(listener).toHaveBeenCalledTimes(calls);
	const next = vi.fn();
	const stop = subscribeOfflinePublicData(next);
	expect(next).toHaveBeenCalledExactlyOnceWith({
		phase: 'ready',
		courseCount: 3362,
		refreshError: 'A later selected degree failure'
	});
	stop();
});

it('reports subscriber bugs without preventing another view from seeing data errors', async () => {
	const reported = vi.fn();
	vi.stubGlobal('reportError', reported);
	const { subscribeOfflinePublicData } = await import('./offlineData');
	const stopBroken = subscribeOfflinePublicData(() => {
		throw new Error('view failed');
	});
	const listener = vi.fn();
	const stop = subscribeOfflinePublicData(listener);
	reportRefreshError('Visible error');
	expect(listener).toHaveBeenLastCalledWith({
		phase: 'idle',
		courseCount: 0,
		refreshError: 'Visible error'
	});
	stopBroken();
	stop();
	expect(refresh.listeners.size).toBe(0);
	expect(reported).toHaveBeenCalledWith(
		expect.objectContaining({ message: 'view failed' })
	);
	vi.unstubAllGlobals();
});

it('surfaces unexpected readiness exceptions instead of inventing missing-cache state', async () => {
	prepare.mockResolvedValue({ ready: true, courseCount: 3362 });
	const { prepareOfflinePublicData, bootstrapOfflinePublicData } =
		await import('./offlineData');
	await prepareOfflinePublicData();
	readiness.mockRejectedValue(new Error('Unexpected readiness bug'));
	expect(await prepareOfflinePublicData()).toMatchObject({
		phase: 'error',
		courseCount: 3362,
		error: 'Unexpected readiness bug'
	});
	await expect(bootstrapOfflinePublicData()).rejects.toThrow(
		'Unexpected readiness bug'
	);
});

it('keeps the actual setup error visible during retry until durable recovery', async () => {
	prepare.mockRejectedValueOnce(
		new Error('Browser storage denied this write.')
	);
	const { prepareOfflinePublicData, subscribeOfflinePublicData } =
		await import('./offlineData');
	await prepareOfflinePublicData();
	let finish!: (result: { ready: boolean; courseCount: number }) => void;
	prepare.mockReturnValue(
		new Promise((resolve) => {
			finish = resolve;
		})
	);
	const snapshots: { phase: string; error?: string }[] = [];
	const unsubscribe = subscribeOfflinePublicData((state) =>
		snapshots.push({ phase: state.phase, error: state.error })
	);
	const retry = prepareOfflinePublicData();
	expect(snapshots.at(-1)).toEqual({
		phase: 'loading',
		error: 'Browser storage denied this write.'
	});
	finish({ ready: true, courseCount: 3362 });
	await retry;
	expect(snapshots.at(-1)).toEqual({ phase: 'ready', error: undefined });
	unsubscribe();
});

it('replays and forwards measured progress to a later bootstrap sharing preparation', async () => {
	let report!: (
		progress: import('./consoleLoading').DataLoadingProgress
	) => void;
	let finish!: (result: { ready: boolean; courseCount: number }) => void;
	prepare.mockImplementation((_fetch, onProgress) => {
		report = onProgress;
		return new Promise((resolve) => {
			finish = resolve;
		});
	});
	const { prepareOfflinePublicData } = await import('./offlineData');
	const initial = prepareOfflinePublicData();
	report({ completed: 1, total: 2, pending: ['/courseData.json'] });
	const observer = vi.fn();
	const joined = prepareOfflinePublicData(observer);
	expect(observer).toHaveBeenCalledWith({
		completed: 1,
		total: 2,
		pending: ['/courseData.json']
	});
	report({ completed: 2, total: 2, pending: [] });
	expect(observer).toHaveBeenLastCalledWith({
		completed: 2,
		total: 2,
		pending: []
	});
	finish({ ready: true, courseCount: 20 });
	await Promise.all([initial, joined]);
	report({ completed: 0, total: 2, pending: [] });
	expect(observer).toHaveBeenCalledTimes(2);
});
