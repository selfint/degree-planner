import { describe, expect, it } from 'vitest';
import { journeyRanges } from './journeyTimeline.mjs';
const pixels = (runs) =>
	Buffer.from(
		runs.flatMap(([count, color]) =>
			Array.from({ length: count }, () => color).flat()
		)
	);
const pink = [255, 0, 255],
	black = [0, 0, 0];
describe('asserted journey video boundaries', () => {
	it('extracts multiple named segments from one page with idle time excluded', () => {
		expect(
			journeyRanges(
				pixels([
					[5, black],
					[4, pink],
					[10, black],
					[4, pink],
					[20, black],
					[4, pink],
					[15, black],
					[4, pink]
				]),
				10,
				2
			)
		).toEqual([
			{ start: 0.9, duration: 1 },
			{ start: 4.7, duration: 1.5 }
		]);
	});
	it('rejects missing markers rather than publishing setup or blank pages', () => {
		expect(() =>
			journeyRanges(
				pixels([
					[4, pink],
					[10, black]
				]),
				10,
				1
			)
		).toThrow('boundaries');
	});
	it('rejects invalid frame rates', () =>
		expect(() => journeyRanges(Buffer.alloc(0), 0, 0)).toThrow());
});
