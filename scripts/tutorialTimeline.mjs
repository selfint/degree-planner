/** Locate the scene after the recording-only magenta slate in decoded RGB pixels. */
export function recordingStart(rgb, fps) {
	if (!Number.isFinite(fps) || fps <= 0)
		throw new Error('Invalid recording frame rate');
	let slateFrames = 0;
	for (let frame = 0; frame < rgb.length / 3; frame++) {
		const [r, g, b] = rgb.subarray(frame * 3, frame * 3 + 3);
		const slate = r > 230 && g < 35 && b > 230;
		if (slate) slateFrames++;
		else if (slateFrames >= 3) return frame / fps;
		else slateFrames = 0;
	}
	throw new Error(
		'Recording slate missing or incomplete; cannot safely trim setup'
	);
}
