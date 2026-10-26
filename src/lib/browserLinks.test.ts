import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserLink } from './browserLinks';

afterEach(() => vi.unstubAllGlobals());

function setup(displayMode = false, iosStandalone?: boolean) {
	const media = {
		matches: displayMode,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	};
	const window = {
		matchMedia: vi.fn(() => media),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	};
	vi.stubGlobal('window', window);
	vi.stubGlobal('navigator', { standalone: iosStandalone });
	const anchor = { target: '_blank' } as HTMLAnchorElement;
	const action = browserLink(anchor);
	return { anchor, action, media, window };
}

describe('out-of-scope browser links', () => {
	it('preserves new tabs in ordinary browsers', () => {
		const { anchor, window } = setup();
		expect(anchor.target).toBe('_blank');
		expect(window.matchMedia).toHaveBeenCalledWith(
			'(display-mode: standalone)'
		);
	});
	it.each([
		[true, undefined],
		[false, true]
	])(
		'lets the installed app hand off a native out-of-scope navigation',
		(mode, ios) => {
			const { anchor } = setup(mode, ios);
			expect(anchor.target).toBe('_self');
		}
	);
	it('updates on display-mode changes and releases both listeners', () => {
		const { anchor, action, media, window } = setup();
		const update = media.addEventListener.mock.calls[0][1];
		media.matches = true;
		update();
		expect(anchor.target).toBe('_self');
		media.matches = false;
		update();
		expect(anchor.target).toBe('_blank');
		expect(window.addEventListener).toHaveBeenCalledWith('pageshow', update);
		action.destroy();
		expect(media.removeEventListener).toHaveBeenCalledWith('change', update);
		expect(window.removeEventListener).toHaveBeenCalledWith('pageshow', update);
	});
});
