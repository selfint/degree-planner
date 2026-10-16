import { beforeEach, describe, expect, it, vi } from 'vitest';
const prepare = vi.hoisted(() => vi.fn());
vi.mock('./publicData', () => ({ preparePublicCourseData: prepare }));
beforeEach(() => {
	vi.resetModules();
	prepare.mockReset();
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
