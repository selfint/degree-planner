import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	firebase: vi.fn(),
	bootstrap: vi.fn(),
	report: vi.fn()
}));
vi.mock('$lib/firebase.svelte', () => ({ initFirebase: mocks.firebase }));
vi.mock('$lib/offlineData', () => ({
	bootstrapOfflinePublicData: mocks.bootstrap
}));
vi.mock('$lib/consoleLoading', () => ({ reportConsoleLoading: mocks.report }));
beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
});
describe('console loading lifecycle', () => {
	it('does not let late data progress erase a startup error', async () => {
		let progress!: (value: unknown) => void;
		let resolveData!: (value: unknown) => void;
		mocks.bootstrap.mockImplementation((callback) => {
			progress = callback;
			return new Promise((resolve) => {
				resolveData = resolve;
			});
		});
		mocks.firebase.mockRejectedValue(new Error('auth storage denied'));
		const { load } = await import('../routes/app/+layout');
		await expect(load(undefined as never)).rejects.toThrow(
			'auth storage denied'
		);
		progress({ completed: 1, total: 2, pending: ['/courseData.json'] });
		resolveData({ phase: 'ready', courseCount: 1 });
		await Promise.resolve();
		expect(mocks.report).toHaveBeenLastCalledWith({ phase: 'error' });
		expect(mocks.report.mock.calls.map(([value]) => value.phase)).toEqual([
			'checking',
			'error'
		]);
	});
	it('ignores an older load after a newer load starts', async () => {
		const callbacks: ((value: unknown) => void)[] = [];
		const resolvers: ((value: unknown) => void)[] = [];
		mocks.firebase.mockResolvedValue({});
		mocks.bootstrap.mockImplementation((callback) => {
			callbacks.push(callback);
			return new Promise((resolve) => resolvers.push(resolve));
		});
		const { load } = await import('../routes/app/+layout');
		const old = load(undefined as never);
		const current = load(undefined as never);
		callbacks[0]({ completed: 1, total: 2, pending: [] });
		resolvers[0]({ phase: 'ready' });
		await old;
		expect(mocks.report.mock.calls.map(([value]) => value.phase)).toEqual([
			'checking',
			'checking'
		]);
		callbacks[1]({ completed: 1, total: 2, pending: ['/courseData.json'] });
		expect(mocks.report).toHaveBeenLastCalledWith({
			phase: 'data',
			completed: 1,
			total: 2,
			pending: ['/courseData.json']
		});
		resolvers[1]({ phase: 'ready' });
		await current;
		expect(mocks.report).toHaveBeenLastCalledWith({ phase: 'finishing' });
	});
});
