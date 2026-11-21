import { describe, expect, it, vi } from 'vitest';
import {
	createOwnSavedPlanVisit,
	markPersistedPlan,
	isPersistedPlan
} from './ownSavedPlanView';

const plan = () => ({
	semesters: [['private-course']],
	wishlist: [],
	exemptions: [],
	currentSemester: 0
});
const shown = {
	ready: true,
	persisted: true,
	hasCourses: true,
	hasChanges: false
};

describe('own saved plan visit', () => {
	it('waits for actual display, then counts once across rerenders and auth updates', () => {
		const capture = vi.fn();
		const visit = createOwnSavedPlanVisit(capture);
		visit({ ...shown, ready: false });
		expect(capture).not.toHaveBeenCalled();
		visit(shown);
		visit(shown);
		visit({ ...shown, ready: false });
		visit(shown);
		expect(capture).toHaveBeenCalledExactlyOnceWith();
	});
	it.each([{ persisted: false }, { hasCourses: false }, { hasChanges: true }])(
		'does not turn an excluded initial display into a view after editing/saving: %j',
		(state) => {
			const capture = vi.fn();
			const visit = createOwnSavedPlanVisit(capture);
			visit({ ...shown, ...state });
			visit(shown);
			expect(capture).not.toHaveBeenCalled();
		}
	);
	it('counts a return visit independently', () => {
		const capture = vi.fn();
		createOwnSavedPlanVisit(capture)(shown);
		createOwnSavedPlanVisit(capture)(shown);
		expect(capture).toHaveBeenCalledTimes(2);
	});
	it('recognizes only persisted, unchanged snapshots, not copies or mutated drafts', () => {
		const data = plan();
		expect(isPersistedPlan(data)).toBe(false);
		expect(markPersistedPlan(data)).toBe(data);
		expect(isPersistedPlan(data)).toBe(true);
		expect(isPersistedPlan({ ...data })).toBe(false);
		data.semesters[0].push('unsaved');
		expect(isPersistedPlan(data)).toBe(false);
	});
});
