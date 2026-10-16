/** Move the decorative landing glow without rerendering or shifting the content. */
export function landingParallax(node: HTMLElement) {
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	let frame: number | undefined;
	let rootFontSize = 16;

	function update() {
		frame = undefined;
		// Follow 80% of the scroll so the glow stays with the reader farther down.
		// Scroll coordinates are pixels; keep the rendered distance in rem.
		const offset = (Math.max(0, window.scrollY) * 0.8) / rootFontSize;
		node.style.setProperty('--landing-parallax-offset', `${offset}rem`);
	}

	function scheduleUpdate() {
		if (frame === undefined) frame = window.requestAnimationFrame(update);
	}

	function resize() {
		rootFontSize =
			parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		scheduleUpdate();
	}

	function stop() {
		window.removeEventListener('scroll', scheduleUpdate);
		window.removeEventListener('resize', resize);
		if (frame !== undefined) window.cancelAnimationFrame(frame);
		frame = undefined;
		node.style.removeProperty('--landing-parallax-offset');
	}

	function syncMotionPreference() {
		stop();
		if (reducedMotion.matches) return;
		resize();
		window.addEventListener('scroll', scheduleUpdate, { passive: true });
		window.addEventListener('resize', resize);
	}

	reducedMotion.addEventListener('change', syncMotionPreference);
	syncMotionPreference();

	return {
		destroy() {
			stop();
			reducedMotion.removeEventListener('change', syncMotionPreference);
		}
	};
}
