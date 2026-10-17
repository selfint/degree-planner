import { beforeEach, describe, expect, it, vi } from 'vitest';
const prepare = vi.hoisted(() => vi.fn());
const readiness = vi.hoisted(() => vi.fn());
vi.mock('./publicData', () => ({
	preparePublicCourseData: prepare,
	readPublicCourseDataReadiness: readiness
}));
beforeEach(() => {
	vi.resetModules();
	prepare.mockReset();
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
