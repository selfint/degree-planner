// Both boundaries are encoded into actual frames, not estimated wall-clock time.
export function journeyRanges(rgb, fps, expected) {
	if (!Number.isFinite(fps) || fps <= 0)
		throw new Error('Invalid video frame rate');
	const bands = [];
	let start = -1;
	for (let frame = 0; frame <= rgb.length / 3; frame++) {
		const [r, g, b] = rgb.subarray(frame * 3, frame * 3 + 3);
		const marker = r > 230 && g < 35 && b > 230;
		if (marker && start < 0) start = frame;
		if (!marker && start >= 0) {
			if (frame - start >= 3) bands.push([start, frame]);
			start = -1;
		}
	}
	if (bands.length !== expected * 2)
		throw new Error(
			`Expected ${expected * 2} boundaries, found ${bands.length}`
		);
	return Array.from({ length: expected }, (_, i) => {
		const start = bands[i * 2][1] / fps,
			end = bands[i * 2 + 1][0] / fps;
		if (end <= start) throw new Error('Empty journey segment');
		return { start, duration: (bands[i * 2 + 1][0] - bands[i * 2][1]) / fps };
	});
}
