import { expect, it } from 'vitest';
import { recordingStart } from './tutorialTimeline.mjs';
const frames = (...runs) =>
	Buffer.from(
		runs.flatMap(([n, rgb]) => Array.from({ length: n }, () => rgb).flat())
	);
it('locates the first scene frame after the recording-only slate, independent of setup wall time', () => {
	expect(
		recordingStart(
			frames([7, [0, 0, 0]], [8, [253, 2, 252]], [25, [240, 240, 240]]),
			25
		)
	).toBe(0.6);
	expect(
		recordingStart(
			frames([50, [0, 0, 0]], [8, [253, 2, 252]], [25, [240, 240, 240]]),
			25
		)
	).toBe(2.32);
});
it('rejects a missing or incomplete slate rather than publishing an uncertain trim', () => {
	expect(() => recordingStart(frames([25, [240, 240, 240]]), 25)).toThrow(
		/slate/
	);
	expect(() => recordingStart(frames([8, [253, 2, 252]]), 25)).toThrow(/slate/);
});
