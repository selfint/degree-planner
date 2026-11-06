import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fitPlanToViewport } from './fitPlanToViewport';

let resize: () => void;
let childrenChanged: () => void;
let events: EventTarget & { innerHeight: number; scrollY: number };
const resizeObserve = vi.fn();
const resizeDisconnect = vi.fn();
const mutationObserve = vi.fn();
const mutationDisconnect = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
	events = Object.assign(new EventTarget(), { innerHeight: 844, scrollY: 0 });
	vi.stubGlobal('window', events);
	vi.stubGlobal('document', { documentElement: {} });
	vi.stubGlobal('getComputedStyle', () => ({
		marginBottom: '16px',
		fontSize: '16px'
	}));
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: () => void) {
				resize = callback;
			}
			observe = resizeObserve;
			disconnect = resizeDisconnect;
		}
	);
	vi.stubGlobal(
		'MutationObserver',
		class {
			constructor(callback: () => void) {
				childrenChanged = callback;
			}
			observe = mutationObserve;
			disconnect = mutationDisconnect;
		}
	);
});
afterEach(() => vi.unstubAllGlobals());

it('tracks inserted and removed notices and observes newly added chrome sizes', () => {
	type ChromeNode = { previousElementSibling: ChromeNode | null };
	const header: ChromeNode = { previousElementSibling: null };
	const wrapper = {};
	const main = { previousElementSibling: header, parentElement: wrapper };
	let top = 140;
	const el = {
		closest: () => main,
		getBoundingClientRect: () => ({ top }),
		style: { minHeight: '' }
	};
	const action = fitPlanToViewport(el as unknown as HTMLElement);
	expect(el.style.minHeight).toBe('43rem');
	expect(resizeObserve).toHaveBeenCalledWith(header);
	// No subtree/attributes observation: style changes cannot feed back.
	expect(mutationObserve).toHaveBeenCalledExactlyOnceWith(wrapper, {
		childList: true
	});

	const notice = { previousElementSibling: header };
	main.previousElementSibling = notice;
	top = 200;
	childrenChanged();
	expect(el.style.minHeight).toBe('39.25rem');
	expect(resizeObserve).toHaveBeenCalledWith(notice);

	top = 220;
	resize();
	expect(el.style.minHeight).toBe('38rem');

	main.previousElementSibling = header;
	top = 140;
	resizeObserve.mockClear();
	childrenChanged();
	expect(el.style.minHeight).toBe('43rem');
	expect(resizeObserve).toHaveBeenCalledExactlyOnceWith(header);

	const disconnects = resizeDisconnect.mock.calls.length;
	action.destroy();
	expect(resizeDisconnect).toHaveBeenCalledTimes(disconnects + 1);
	expect(mutationDisconnect).toHaveBeenCalledOnce();
	events.innerHeight = 540;
	events.dispatchEvent(new Event('resize'));
	expect(el.style.minHeight).toBe('43rem');
});

it('uses document-relative top on resize and clamps exhausted viewport space', () => {
	const el = {
		closest: () => null,
		getBoundingClientRect: () => ({ top: 100 }),
		style: { minHeight: '' }
	};
	events.scrollY = 40;
	const action = fitPlanToViewport(el as unknown as HTMLElement);
	expect(el.style.minHeight).toBe('43rem');
	events.innerHeight = 140;
	events.dispatchEvent(new Event('resize'));
	expect(el.style.minHeight).toBe('0rem');
	action.destroy();
});
