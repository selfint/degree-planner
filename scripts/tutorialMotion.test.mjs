import { describe, it, expect, vi } from 'vitest';
import {
	ease,
	movePointer,
	setPointerPosition
} from '../tutorials/helpers/motion';

describe('recording pointer timing', () => {
	it('requires the real cursor starting position', async () => {
		await expect(movePointer({}, { x: 20, y: 40 })).rejects.toThrow('Register');
	});
	it('emits intermediate real moves over the complete requested duration', async () => {
		const events = [];
		const page = {
			evaluate: vi.fn(async () => {}),
			waitForTimeout: vi.fn(async (ms) => events.push(['wait', ms])),
			mouse: { move: vi.fn(async (x, y) => events.push(['move', x, y])) }
		};
		setPointerPosition(page, { x: 0, y: 0 });
		await movePointer(page, { x: 100, y: 200 }, 1600);
		expect(page.mouse.move).toHaveBeenCalledTimes(64);
		expect(page.evaluate).toHaveBeenCalledTimes(64);
		expect(
			events.filter((e) => e[0] === 'wait').reduce((sum, e) => sum + e[1], 0)
		).toBe(1600);
		expect(events.at(-1)).toEqual(['move', 100, 200]);
		const moves = events.filter((e) => e[0] === 'move');
		expect(moves[0][1]).toBeGreaterThan(0);
		expect(moves[0][1]).toBeLessThan(1);
		expect(moves[31]).toEqual(['move', 50, 100]);
		expect(moves.every((e, i) => !i || e[1] > moves[i - 1][1])).toBe(true);
		await movePointer(page, { x: 200, y: 300 }, 50);
		expect(events.at(-3)).toEqual(['move', 150, 250]);
	});
	it('eases monotonically with exact endpoints', () => {
		expect(ease(0)).toBe(0);
		expect(ease(0.5)).toBe(0.5);
		expect(ease(1)).toBe(1);
	});
});
