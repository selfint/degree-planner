import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	assertPlanWritable,
	isPlanWritable,
	OfflinePlanWriteError,
	planOnline
} from './planAccess';

let network: { onLine: boolean };
let events: EventTarget;
beforeEach(() => {
	network = { onLine: true };
	events = new EventTarget();
	vi.stubGlobal('navigator', network);
	vi.stubGlobal('window', events);
});
afterEach(() => vi.unstubAllGlobals());

describe('plan connectivity', () => {
	it('rechecks the current browser state at every write boundary', () => {
		expect(isPlanWritable()).toBe(true);
		expect(() => assertPlanWritable()).not.toThrow();
		network.onLine = false;
		expect(isPlanWritable()).toBe(false);
		expect(() => assertPlanWritable()).toThrow(OfflinePlanWriteError);
	});

	it('updates controls on disconnect, reconnect, and page restoration', () => {
		const states: boolean[] = [];
		const unsubscribe = planOnline.subscribe((online) => states.push(online));
		network.onLine = false;
		events.dispatchEvent(new Event('offline'));
		network.onLine = true;
		events.dispatchEvent(new Event('online'));
		network.onLine = false;
		events.dispatchEvent(new Event('pageshow'));
		expect(states).toEqual([true, false, true, false]);
		unsubscribe();
	});

	it('refreshes initial state and removes listeners after the last subscriber', () => {
		const remove = vi.spyOn(events, 'removeEventListener');
		network.onLine = false;
		expect(get(planOnline)).toBe(false);
		expect(remove.mock.calls.map(([event]) => event)).toEqual([
			'online',
			'offline',
			'pageshow'
		]);
		network.onLine = true;
		expect(get(planOnline)).toBe(true);
	});
});
