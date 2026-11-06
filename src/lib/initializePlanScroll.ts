/** Start each horizontal planner rail at its reading edge once it is visible. */
export function initializePlanScroll(el: HTMLElement, direction: string) {
	let pending = true;

	function alignStart() {
		// The console mounts its plan under display:none while account data loads.
		// A hidden rail has no scroll range, so wait for its first measurable size.
		if (!pending || el.clientWidth === 0) return;
		// Sortable needs nonnegative scrollLeft: the rail stays LTR even when its
		// course row is RTL. Only initial placement or a language change resets it.
		el.scrollLeft =
			direction === 'rtl' ? Math.max(0, el.scrollWidth - el.clientWidth) : 0;
		pending = false;
	}

	const observer = new ResizeObserver(alignStart);
	observer.observe(el);
	alignStart();

	return {
		update(nextDirection: string) {
			if (nextDirection === direction) return;
			direction = nextDirection;
			pending = true;
			alignStart();
		},
		destroy() {
			pending = false;
			observer.disconnect();
		}
	};
}
