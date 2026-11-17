import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	firebase: vi.fn(),
	preflight: vi.fn(),
	bootstrap: vi.fn(),
	report: vi.fn(),
	entry: vi.fn()
}));
vi.mock('$lib/consoleEntry', () => ({ redirectConsoleEntry: mocks.entry }));
vi.mock('$lib/pwa/entry-preflight', () => ({
	prepareEntryRelease: mocks.preflight
}));
vi.mock('$lib/firebase.svelte', () => ({ initFirebase: mocks.firebase }));
vi.mock('$lib/offlineData', () => ({
	bootstrapOfflinePublicData: mocks.bootstrap
}));
vi.mock('$lib/consoleLoading', () => ({ reportConsoleLoading: mocks.report }));
beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	mocks.preflight.mockResolvedValue(undefined);
	mocks.entry.mockImplementation(() => {
		throw new Error('entry redirect');
	});
});
describe('console loading lifecycle', () => {
	it('redirects the manifest entry before starting bootstrap or reporting progress', async () => {
		const { load } = await import('../routes/app/+layout');
		const untrack = vi.fn((read: () => unknown) => read());
		await expect(
			load({ route: { id: '/app' }, untrack } as never)
		).rejects.toThrow('entry redirect');
		expect(untrack).toHaveBeenCalledOnce();
		expect(mocks.entry).toHaveBeenCalledOnce();
		expect(mocks.preflight).not.toHaveBeenCalled();
		expect(mocks.bootstrap).not.toHaveBeenCalled();
		expect(mocks.firebase).not.toHaveBeenCalled();
		expect(mocks.report).not.toHaveBeenCalled();
	});
	it('does not start data or auth bootstrap until the release check finishes', async () => {
		let finish!: () => void;
		mocks.preflight.mockReturnValue(
			new Promise<void>((resolve) => {
				finish = resolve;
			})
		);
		mocks.bootstrap.mockResolvedValue({ phase: 'ready' });
		mocks.firebase.mockResolvedValue({});
		const { load } = await import('../routes/app/+layout');
		const pending = load({
			route: { id: '/app/(withCourseData)/plan' },
			untrack: (read: () => unknown) => read()
		} as never);
		expect(mocks.bootstrap).not.toHaveBeenCalled();
		expect(mocks.firebase).not.toHaveBeenCalled();
		finish();
		await pending;
		expect(mocks.bootstrap).toHaveBeenCalledOnce();
	});
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
		await expect(
			load({
				route: { id: '/app/(withCourseData)/plan' },
				untrack: (read: () => unknown) => read()
			} as never)
		).rejects.toThrow('auth storage denied');
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
		const old = load({
			route: { id: '/app/(withCourseData)/plan' },
			untrack: (read: () => unknown) => read()
		} as never);
		const current = load({
			route: { id: '/app/(withCourseData)/plan' },
			untrack: (read: () => unknown) => read()
		} as never);
		await vi.waitFor(() => expect(callbacks).toHaveLength(2));
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
