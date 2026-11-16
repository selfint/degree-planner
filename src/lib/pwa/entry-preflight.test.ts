import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
	check: vi.fn(),
	dispose: vi.fn(),
	activate: vi.fn(),
	blocked: vi.fn(),
	readVersion: vi.fn(),
	controller: vi.fn()
}));
vi.mock('./update-check-scheduler', () => ({
	createUpdateCheckScheduler: () => ({
		checkOnEntry: h.check,
		dispose: h.dispose
	})
}));
vi.mock('./update-safety', () => ({ updateSafety: { blocked: h.blocked } }));
vi.mock('./service-worker-update', () => ({
	hasWaitingUpdate: (waiting: unknown, active: unknown) =>
		!!waiting && waiting !== active,
	readWaitingWorkerVersion: h.readVersion
}));
vi.mock('./update-activation', () => ({
	requestUpdateActivation: h.activate,
	waitForUpdateController: h.controller
}));

beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
	h.check.mockResolvedValue(true);
	h.blocked.mockReturnValue(false);
	h.readVersion.mockResolvedValue('B');
	h.activate.mockResolvedValue('other-tabs');
	h.controller.mockReturnValue({
		promise: Promise.resolve(),
		dispose: vi.fn()
	});
	vi.stubGlobal('location', {
		href: 'https://local.test/staging/app/plan',
		origin: 'https://local.test',
		pathname: '/staging/app/plan',
		reload: vi.fn()
	});
	vi.stubGlobal('sessionStorage', { setItem: vi.fn() });
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

async function setup(waiting = true) {
	const worker = {
		scriptURL: 'https://local.test/staging/service-worker.js',
		state: 'installed'
	};
	const registration = {
		scope: 'https://local.test/staging/app/',
		active: { scriptURL: worker.scriptURL },
		waiting: waiting ? worker : undefined
	};
	vi.stubGlobal('navigator', {
		serviceWorker: {
			getRegistration: vi.fn().mockResolvedValue(registration),
			controller: worker
		}
	});
	return { ...(await import('./entry-preflight')), worker, registration };
}

describe('release preflight before data bootstrap', () => {
	it('checks once per document and leaves later checks to the running shell', async () => {
		const p = await setup(false);
		await p.prepareEntryRelease('A', '/staging');
		await p.prepareEntryRelease('A', '/staging');
		expect(h.check).toHaveBeenCalledOnce();
		expect(p.entryUpdateChecked()).toBe(true);
		expect(h.dispose).toHaveBeenCalledOnce();
	});
	it('never activates while unsaved work blocks reload', async () => {
		const p = await setup();
		h.blocked.mockReturnValue(true);
		await p.prepareEntryRelease('A', '/staging');
		expect(h.activate).not.toHaveBeenCalled();
		expect(location.reload).not.toHaveBeenCalled();
	});
	it('keeps another tab safe and releases bootstrap after refused activation', async () => {
		const p = await setup();
		await p.prepareEntryRelease('A', '/staging');
		expect(h.activate).toHaveBeenCalledWith(p.worker, 'B');
		expect(location.reload).not.toHaveBeenCalled();
	});
	it('does not finish old-document bootstrap after a verified reload starts', async () => {
		const p = await setup();
		h.activate.mockResolvedValue('accepted');
		const done = vi.fn();
		void p.prepareEntryRelease('A', '/staging').then(done);
		await vi.waitFor(() => expect(location.reload).toHaveBeenCalledOnce());
		expect(done).not.toHaveBeenCalled();
		expect(sessionStorage.setItem).toHaveBeenCalledWith(
			'planit-entry-release-reload',
			expect.any(String)
		);
	});
	it('times out without allowing late discovery to reload an editable session', async () => {
		vi.useFakeTimers();
		const p = await setup(false);
		let resolve!: () => void;
		h.check.mockReturnValue(
			new Promise<void>((r) => {
				resolve = r;
			})
		);
		const ready = p.prepareEntryRelease('A', '/staging');
		await vi.advanceTimersByTimeAsync(30001);
		await ready;
		p.registration.waiting = p.worker;
		resolve();
		await vi.advanceTimersByTimeAsync(1);
		expect(h.activate).not.toHaveBeenCalled();
		expect(p.entryUpdateChecked()).toBe(true);
		expect(p.entryUpdateFailed()).toBe(true);
	});
});
