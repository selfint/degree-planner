import { afterEach, describe, expect, it, vi } from 'vitest';
import { landingParallax } from './landingParallax';

afterEach(() => vi.unstubAllGlobals());

function setup(reduce = false) {
	const media = Object.assign(new EventTarget(), { matches: reduce });
	const frames = new Map<number, FrameRequestCallback>();
	let frameId = 0;
	const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
		frames.set(++frameId, callback);
		return frameId;
	});
	const window = Object.assign(new EventTarget(), {
		scrollY: 0,
		matchMedia: () => media,
		requestAnimationFrame,
		cancelAnimationFrame: (id: number) => frames.delete(id)
	});
	const style = new Map<string, string>();
	const node = {
		style: {
			setProperty: (key: string, value: string) => style.set(key, value),
			removeProperty: (key: string) => style.delete(key)
		}
	} as unknown as HTMLElement;
	const getComputedStyle = vi.fn(() => ({ fontSize: '16px' }));
	vi.stubGlobal('window', window);
	vi.stubGlobal('document', { documentElement: {} });
	vi.stubGlobal('getComputedStyle', getComputedStyle);
	return {
		window,
		media,
		node,
		frames,
		style,
		getComputedStyle,
		requestAnimationFrame,
		flush() {
			const pending = [...frames.values()];
			frames.clear();
			pending.forEach((callback) => callback(0));
		}
	};
}

describe('landing gradient parallax', () => {
	it('batches scroll updates into one frame and uses the latest position', () => {
		const state = setup();
		const action = landingParallax(state.node);
		state.flush();
		state.window.scrollY = 100;
		state.window.dispatchEvent(new Event('scroll'));
		state.window.scrollY = 300;
		state.window.dispatchEvent(new Event('scroll'));
		expect(state.frames.size).toBe(1);
		state.flush();
		expect(state.style.get('--landing-parallax-offset')).toBe('15rem');
		// Reading layout is only needed at setup/resize, never for each scroll.
		expect(state.getComputedStyle).toHaveBeenCalledTimes(1);
		action.destroy();
	});

	it('restores a scrolled position, scales rem on resize, and ignores overscroll', () => {
		const state = setup();
		state.window.scrollY = 400;
		const action = landingParallax(state.node);
		state.flush();
		expect(state.style.get('--landing-parallax-offset')).toBe('20rem');
		state.getComputedStyle.mockReturnValue({ fontSize: '20px' });
		state.window.dispatchEvent(new Event('resize'));
		state.flush();
		expect(state.style.get('--landing-parallax-offset')).toBe('16rem');
		state.window.scrollY = -20;
		state.window.dispatchEvent(new Event('scroll'));
		state.flush();
		expect(state.style.get('--landing-parallax-offset')).toBe('0rem');
		action.destroy();
	});

	it('keeps following far down long pages without an early travel limit', () => {
		const state = setup();
		const action = landingParallax(state.node);
		state.window.scrollY = 3600;
		state.window.dispatchEvent(new Event('scroll'));
		state.flush();
		expect(state.style.get('--landing-parallax-offset')).toBe('180rem');
		action.destroy();
	});

	it('does no scroll work when reduced motion is preferred', () => {
		const state = setup(true);
		const action = landingParallax(state.node);
		state.window.dispatchEvent(new Event('scroll'));
		state.window.dispatchEvent(new Event('resize'));
		expect(state.requestAnimationFrame).not.toHaveBeenCalled();
		expect(state.style.size).toBe(0);
		action.destroy();
	});

	it('responds to motion preference changes and cancels pending work', () => {
		const state = setup();
		const action = landingParallax(state.node);
		state.flush();
		state.window.dispatchEvent(new Event('scroll'));
		state.media.matches = true;
		state.media.dispatchEvent(new Event('change'));
		expect(state.frames.size).toBe(0);
		expect(state.style.size).toBe(0);
		state.window.dispatchEvent(new Event('scroll'));
		expect(state.frames.size).toBe(0);
		state.media.matches = false;
		state.media.dispatchEvent(new Event('change'));
		state.window.scrollY = 600;
		state.flush();
		expect(state.style.get('--landing-parallax-offset')).toBe('30rem');
		action.destroy();
	});

	it('removes listeners and queued animation frames when leaving the page', () => {
		const state = setup();
		const action = landingParallax(state.node);
		action.destroy();
		state.window.dispatchEvent(new Event('scroll'));
		state.window.dispatchEvent(new Event('resize'));
		state.media.dispatchEvent(new Event('change'));
		expect(state.frames.size).toBe(0);
		expect(state.style.size).toBe(0);
	});
});
