/** Keep the decorative glow in sync with scrolling without shifting content. */
export function landingParallax(node: HTMLElement) {
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const nativeTimeline = CSS.supports('animation-timeline', 'scroll(root y)');
	let frame: number | undefined;
	let observer: ResizeObserver | undefined;
	let rootFontSize = 16;
	let maxScroll = 0;

	function update() {
		frame = undefined;
		// Clamp Safari's elastic overscroll to the same range as a native timeline.
		const scroll = Math.min(maxScroll, Math.max(0, window.scrollY));
		node.style.setProperty(
			'--landing-parallax-offset',
			`${(scroll * 0.8) / rootFontSize}rem`
		);
	}

	function scheduleUpdate() {
		if (frame === undefined) frame = window.requestAnimationFrame(update);
	}

	function resize() {
		const root = document.documentElement;
		rootFontSize = parseFloat(getComputedStyle(root).fontSize) || 16;
		maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
		if (nativeTimeline) {
			// A root timeline spans the full scroll range. Only layout changes need JS;
			// the browser owns every scroll frame, including momentum and reversals.
			node.style.setProperty(
				'--landing-parallax-travel',
				`${(maxScroll * 0.8) / rootFontSize}rem`
			);
		} else {
			scheduleUpdate();
		}
	}

	function stop() {
		window.removeEventListener('scroll', scheduleUpdate);
		window.removeEventListener('resize', resize);
		observer?.disconnect();
		observer = undefined;
		if (frame !== undefined) window.cancelAnimationFrame(frame);
		frame = undefined;
		delete node.dataset.parallax;
		node.style.removeProperty('--landing-parallax-offset');
		node.style.removeProperty('--landing-parallax-travel');
	}

	function syncMotionPreference() {
		stop();
		if (reducedMotion.matches) return;
		resize();
		node.dataset.parallax = nativeTimeline ? 'native' : 'fallback';
		observer = new ResizeObserver(resize);
		observer.observe(document.body);
		observer.observe(document.documentElement);
		window.addEventListener('resize', resize);
		if (!nativeTimeline) {
			window.addEventListener('scroll', scheduleUpdate, { passive: true });
		}
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
