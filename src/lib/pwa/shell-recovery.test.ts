import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountShellRecovery, shellRecoveryScript } from './shell-recovery';

function setup(lang = 'en', theme = 'dark', storageDenied = false) {
	let click!: () => Promise<void>;
	const button = {
		disabled: false,
		textContent: '',
		setAttribute: vi.fn(),
		addEventListener: vi.fn((_event, handler) => {
			click = handler;
		})
	};
	const status = { textContent: '' };
	const target = { state: 'installed' } as ServiceWorker;
	const registration = {
		waiting: target as ServiceWorker | null,
		installing: null,
		update: vi.fn().mockResolvedValue(undefined)
	};
	const container = {
		controller: {} as ServiceWorker,
		getRegistration: vi.fn().mockResolvedValue(registration)
	};
	const reload = vi.fn();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => {
			if (storageDenied) throw new Error('denied');
			return key === 'lang' ? lang : theme;
		}
	});
	vi.stubGlobal('document', {
		documentElement: { lang: '', dir: '', dataset: {} },
		getElementById: (id: string) => (id === 'recover-app' ? button : status)
	});
	vi.stubGlobal('navigator', { serviceWorker: container });
	vi.stubGlobal('location', { href: 'https://planit.test/app/plan', reload });
	const read = vi.fn().mockResolvedValue('verified-build');
	const activate = vi.fn().mockImplementation(async () => {
		container.controller = target;
		return 'accepted';
	});
	const dispose = vi.fn();
	const wait = vi.fn().mockReturnValue({ promise: Promise.resolve(), dispose });
	mountShellRecovery(read, activate, wait);
	return {
		click: () => click(),
		button,
		status,
		target,
		registration,
		container,
		reload,
		read,
		activate,
		wait,
		dispose
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
describe('explicit installed shell recovery', () => {
	it('does nothing until clicked and activates only the verified target before reload', async () => {
		const s = setup();
		expect(s.registration.update).not.toHaveBeenCalled();
		expect(s.activate).not.toHaveBeenCalled();
		expect(s.reload).not.toHaveBeenCalled();
		await s.click();
		expect(s.activate).toHaveBeenCalledExactlyOnceWith(
			s.target,
			'verified-build'
		);
		expect(s.reload).toHaveBeenCalledOnce();
		expect(s.dispose).toHaveBeenCalledOnce();
	});
	it('does not replace any other open app document or bypass a sole-client refusal', async () => {
		const s = setup();
		s.activate.mockResolvedValue('other-tabs');
		await s.click();
		expect(s.reload).not.toHaveBeenCalled();
		expect(s.status.textContent).toContain('Save your work');
		expect(s.button.disabled).toBe(false);
	});
	it('does not activate a superseded waiting worker', async () => {
		const s = setup();
		s.read.mockImplementation(async () => {
			s.registration.waiting = {} as ServiceWorker;
			return 'verified-build';
		});
		await s.click();
		expect(s.activate).not.toHaveBeenCalled();
		expect(s.reload).not.toHaveBeenCalled();
	});
	it('does not reload on an unrelated controller change', async () => {
		const s = setup();
		s.activate.mockResolvedValue('accepted');
		await s.click();
		expect(s.reload).not.toHaveBeenCalled();
	});
	it('retains explicit retry after activation succeeds but controller acknowledgement fails', async () => {
		const s = setup();
		s.wait.mockReturnValue({
			promise: Promise.reject(new Error('timeout')),
			dispose: s.dispose
		});
		await s.click();
		expect(s.reload).not.toHaveBeenCalled();
		await s.click();
		expect(s.reload).toHaveBeenCalledOnce();
		expect(s.activate).toHaveBeenCalledOnce();
	});
	it('uses a waiting update immediately without attempting any network update', async () => {
		const s = setup();
		s.registration.update.mockReturnValue(new Promise(() => {}));
		await s.click();
		expect(s.reload).toHaveBeenCalledOnce();
		expect(s.registration.update).not.toHaveBeenCalled();
	});
	it('ignores repeated clicks while acceptance is pending', async () => {
		const s = setup();
		let resolve!: (value: string) => void;
		s.activate.mockImplementation(
			() =>
				new Promise((yes) => {
					resolve = yes;
				})
		);
		const first = s.click();
		await vi.waitFor(() => expect(s.activate).toHaveBeenCalledOnce());
		await s.click();
		expect(s.activate).toHaveBeenCalledOnce();
		resolve('other-tabs');
		await first;
	});
	it('bounds a stalled update check and restores the manual button', async () => {
		vi.useFakeTimers();
		const s = setup();
		s.registration.waiting = null;
		s.registration.update.mockReturnValue(new Promise(() => {}));
		const click = s.click();
		await vi.advanceTimersByTimeAsync(10000);
		await click;
		expect(s.button.disabled).toBe(false);
		expect(s.reload).not.toHaveBeenCalled();
		expect(s.status.textContent).toContain('could not finish');
	});
	it.each([
		['en', 'light', 'ltr', 'Update installed app'],
		['he', 'dark', 'rtl', 'עדכון היישום המותקן']
	])(
		'honors %s and %s without bilingual visible copy',
		(lang, theme, dir, label) => {
			const s = setup(lang, theme);
			expect(document.documentElement.lang).toBe(lang);
			expect(document.documentElement.dir).toBe(dir);
			expect(document.documentElement.dataset.theme).toBe(theme);
			expect(s.button.textContent).toBe(label);
		}
	);
	it('keeps app-default Hebrew dark mode when preference access fails', () => {
		const s = setup('en', 'light', true);
		expect(document.documentElement.lang).toBe('he');
		expect(document.documentElement.dataset.theme).toBe('dark');
		expect(s.button.textContent).toBe('עדכון היישום המותקן');
	});
	it('embeds independently executable protocol functions, not application imports', () => {
		const s = setup();
		s.button.addEventListener.mockClear();
		const script = shellRecoveryScript();
		new Function(script)();
		expect(s.button.addEventListener).toHaveBeenCalledOnce();
		expect(script).not.toContain('import ');
		expect(s.activate).not.toHaveBeenCalled();
	});
});
