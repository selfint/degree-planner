import type { Page } from '@playwright/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectSearchFiltersVisible } from '../../tests/helpers/searchFilters';

const playwright = vi.hoisted(() => ({ expect: vi.fn() }));
vi.mock('@playwright/test', () => ({ expect: playwright.expect }));

function deferred() {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

function harness(bottom = 100, headingTop = 120) {
	const calls: string[] = [];
	const assertion = (label: string) => ({
		label,
		started: deferred(),
		completion: deferred()
	});
	const gates = [
		assertion('fieldset'),
		assertion('boot'),
		assertion('disclosure'),
		assertion('legend')
	];
	const controls = Array.from({ length: 8 }, (_, index) =>
		assertion(`control-${index}`)
	);
	const geometry = vi.fn(async () => ({ bottom, headingTop }));
	const filters = {
		...gates[0],
		locator: (selector: string) => {
			if (selector === 'legend') return gates[3];
			expect(selector).toBe('input, select, button');
			return { all: async () => controls };
		},
		evaluate: geometry
	};
	const page = {
		locator: (selector: string) => {
			if (selector === 'fieldset.search-filters') return filters;
			if (selector === '#console-boot') return gates[1];
			expect(selector).toBe('details.search-filters');
			return gates[2];
		}
	} as unknown as Page;
	playwright.expect.mockImplementation((target) => {
		const start = (matcher: string) => {
			calls.push(`${target.label}:${matcher}`);
			target.started.resolve();
			return target.completion.promise;
		};
		return {
			toBeVisible: () => start('visible'),
			toHaveCount: (count: number) => start(`count=${count}`),
			toBeLessThanOrEqual: (value: number) => {
				calls.push('geometry');
				expect(target).toBeLessThanOrEqual(value);
			}
		};
	});
	return {
		page,
		gates,
		controls,
		calls,
		geometry,
		async releaseReadiness() {
			for (const gate of gates) {
				await gate.started.promise;
				gate.completion.resolve();
			}
			await controls[0].started.promise;
		},
		resolveAll() {
			for (const item of [...gates, ...controls]) item.completion.resolve();
		}
	};
}

beforeEach(() => playwright.expect.mockReset());

describe('search filter visibility assertions', () => {
	it('keeps readiness ordered, starts every control check together, and waits before geometry', async () => {
		const h = harness();
		const pending = expectSearchFiltersVisible(h.page);
		try {
			const readiness = [
				'fieldset:visible',
				'boot:count=0',
				'disclosure:count=0',
				'legend:visible'
			];
			for (const [index, gate] of h.gates.entries()) {
				await gate.started.promise;
				expect(h.calls).toEqual(readiness.slice(0, index + 1));
				gate.completion.resolve();
			}
			await h.controls[0].started.promise;
			expect(h.calls).toEqual([
				...readiness,
				...h.controls.map((control) => `${control.label}:visible`)
			]);
			expect(h.geometry).not.toHaveBeenCalled();
			for (const control of h.controls.slice(1)) control.completion.resolve();
			await Promise.resolve();
			expect(h.geometry).not.toHaveBeenCalled();
			h.controls[0].completion.resolve();
			await pending;
			expect(h.geometry).toHaveBeenCalledOnce();
			expect(h.calls.at(-1)).toBe('geometry');
		} finally {
			h.resolveAll();
			await pending;
		}
	});

	it('propagates a hidden-control failure without proceeding to geometry', async () => {
		const h = harness();
		const pending = expectSearchFiltersVisible(h.page);
		const rejected = expect(pending).rejects.toThrow('control is hidden');
		await h.releaseReadiness();
		h.controls[4].completion.reject(new Error('control is hidden'));
		await rejected;
		expect(h.geometry).not.toHaveBeenCalled();
		h.resolveAll();
	});

	it('still rejects filters positioned below the result heading', async () => {
		const h = harness(121, 120);
		const pending = expectSearchFiltersVisible(h.page);
		const rejected = expect(pending).rejects.toThrow();
		h.resolveAll();
		await rejected;
		expect(h.geometry).toHaveBeenCalledOnce();
		expect(h.calls.at(-1)).toBe('geometry');
	});
});
