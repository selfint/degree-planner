import { describe, expect, it } from 'vitest';
import { canShowPersonalPlan } from './plan-visibility';

describe('personal plan annotations during auth transitions', () => {
	it.each([
		['unresolved auth', false, false, false, false, false],
		['ready guest online', true, false, false, false, true],
		['ready guest offline', true, false, true, false, true],
		['account hydration pending', true, true, false, true, false],
		['account hydration failed', true, true, false, true, false],
		['account ready', true, true, false, false, true],
		['account offline with mounted draft', true, true, true, false, false],
		['account switching', false, true, false, false, false],
		['sign-out loading guest plan', false, false, false, false, false]
	])(
		'%s',
		(_, authReady, signedIn, offline, cloudPlanUnavailable, expected) => {
			expect(
				canShowPersonalPlan({
					authReady,
					signedIn,
					offline,
					cloudPlanUnavailable
				})
			).toBe(expected);
		}
	);
	it('reveals annotations again only after reconnect or sign-out completes', () => {
		const state = {
			authReady: true,
			signedIn: true,
			offline: true,
			cloudPlanUnavailable: true
		};
		expect(canShowPersonalPlan(state)).toBe(false);
		state.offline = false;
		expect(canShowPersonalPlan(state)).toBe(false);
		state.cloudPlanUnavailable = false;
		expect(canShowPersonalPlan(state)).toBe(true);
		state.authReady = false;
		state.signedIn = false;
		expect(canShowPersonalPlan(state)).toBe(false);
		state.authReady = true;
		expect(canShowPersonalPlan(state)).toBe(true);
	});
});
