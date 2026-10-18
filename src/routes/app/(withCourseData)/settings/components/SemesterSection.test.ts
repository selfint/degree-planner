import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';

const state = vi.hoisted(() => ({
	user: {
		d: { semesters: [[], [], [], []] as string[][], currentSemester: 3 }
	}
}));
vi.mock('$lib/stores.svelte', async () => {
	const { cms } = await import('$lib/content');
	return {
		user: state.user,
		content: { lang: cms.en },
		writeStorage: vi.fn(async (data) => data),
		setUser: vi.fn()
	};
});
import SemesterSection, { resizePlanSemesters } from './SemesterSection.svelte';

function totalOptions(semesterChoice = state.user.d.currentSemester) {
	const { body } = render(SemesterSection, {
		props: {
			semesterChoice,
			totalSemestersChoice: state.user.d.semesters.length,
			buttonNamespace: ''
		}
	});
	const selects = [...body.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g)];
	expect(selects).toHaveLength(2);
	return [...selects[1][1].matchAll(/<option\b[^>]*value="(\d+)"/g)].map(
		(option) => Number(option[1])
	);
}

beforeEach(() => {
	state.user.d = { semesters: [[], [], [], []], currentSemester: 3 };
});

describe('semester count protects the selected current semester', () => {
	it('does not offer shortening past a current semester with no courses', () => {
		expect(totalOptions()).toEqual(Array.from({ length: 12 }, (_, i) => i + 4));
	});

	it('requires saving the earlier current semester before allowing a shorter plan', () => {
		// A pending Current choice cannot silently change the saved Current value.
		expect(totalOptions(0)[0]).toBe(4);
		state.user.d.currentSemester = 0;
		expect(totalOptions()[0]).toBe(1);
	});

	it('preserves the separate lower bound protecting nonempty later semesters', () => {
		state.user.d.currentSemester = 0;
		state.user.d.semesters[3] = ['02340124'];
		expect(totalOptions(0)[0]).toBe(4);
	});
});

describe('semester count write boundary', () => {
	it('rejects a stale count without altering the original plan or its courses', () => {
		const plan = {
			...state.user.d,
			wishlist: ['02340141'],
			exemptions: ['01040184']
		};
		const before = structuredClone(plan);
		expect(() => resizePlanSemesters(plan, 2)).toThrow(RangeError);
		expect(plan).toEqual(before);
	});

	it('rechecks newly occupied later semesters before saving a shorter draft', () => {
		state.user.d.currentSemester = 0;
		state.user.d.semesters[3] = ['02340124'];
		expect(() => resizePlanSemesters(state.user.d, 2)).toThrow(RangeError);
		expect(state.user.d.semesters[3]).toEqual(['02340124']);
	});

	it('keeps the 15-semester limit and accepts an explicitly saved earlier current semester', () => {
		state.user.d.currentSemester = 0;
		state.user.d.semesters[0] = ['02340124'];
		const plan = {
			...state.user.d,
			wishlist: ['02340141'],
			exemptions: ['01040184']
		};
		for (const total of [0, 1.5, 16, Number.NaN])
			expect(() => resizePlanSemesters(plan, total)).toThrow(RangeError);
		const shortened = resizePlanSemesters(plan, 2);
		expect(shortened).toEqual({ ...plan, semesters: [['02340124'], []] });
		const expanded = resizePlanSemesters(shortened, 5);
		expect(expanded.semesters).toEqual([['02340124'], [], [], [], []]);
		expect(expanded.semesters[2]).not.toBe(expanded.semesters[3]);
		expect(plan.semesters).toHaveLength(4);
	});
});
