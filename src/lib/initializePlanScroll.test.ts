import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializePlanScroll } from './initializePlanScroll';

let resize: () => void;
const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: () => void) {
				resize = callback;
			}
			observe = observe;
			disconnect = disconnect;
		}
	);
});
afterEach(() => vi.unstubAllGlobals());

it('waits for the auth-hidden RTL rail to become visible before positioning it', () => {
	const rail = { clientWidth: 0, scrollWidth: 0, scrollLeft: 0 };
	const action = initializePlanScroll(rail as HTMLElement, 'rtl');
	expect(observe).toHaveBeenCalledExactlyOnceWith(rail);
	expect(rail.scrollLeft).toBe(0);
	resize();
	expect(rail.scrollLeft).toBe(0);
	// The real console reveals the populated guest/account plan after loading.
	rail.clientWidth = 320;
	rail.scrollWidth = 490;
	resize();
	expect(rail.scrollLeft).toBe(170);
	action.destroy();
});

it('positions an already visible rail immediately in either reading direction', () => {
	const rail = { clientWidth: 390, scrollWidth: 580, scrollLeft: 20 };
	const action = initializePlanScroll(rail as HTMLElement, 'rtl');
	expect(rail.scrollLeft).toBe(190);
	action.update('ltr');
	expect(rail.scrollLeft).toBe(0);
	action.update('rtl');
	expect(rail.scrollLeft).toBe(190);
	action.destroy();
});

it('does not snap a rail back after the user scrolls or drags it', () => {
	const rail = { clientWidth: 320, scrollWidth: 490, scrollLeft: 0 };
	const action = initializePlanScroll(rail as HTMLElement, 'rtl');
	rail.scrollLeft = 65;
	action.update('rtl');
	expect(rail.scrollLeft).toBe(65);
	rail.clientWidth = 390;
	rail.scrollWidth = 580;
	resize();
	expect(rail.scrollLeft).toBe(65);
	resize();
	expect(rail.scrollLeft).toBe(65);
	action.destroy();
});

it('uses the latest language when a hidden rail is revealed and cleans up', () => {
	const rail = { clientWidth: 0, scrollWidth: 0, scrollLeft: 0 };
	const action = initializePlanScroll(rail as HTMLElement, 'ltr');
	action.update('rtl');
	rail.clientWidth = 390;
	rail.scrollWidth = 580;
	resize();
	expect(rail.scrollLeft).toBe(190);
	action.destroy();
	expect(disconnect).toHaveBeenCalledOnce();
	rail.scrollLeft = 30;
	resize();
	expect(rail.scrollLeft).toBe(30);
});
