const measured = new WeakSet<HTMLElement>();

/** The initial sweep is decoration, not a measured starting width. Commit the
 * first real value without a transition, then animate only measured changes.
 * This also prevents a newly mounted loader from replaying the sweep width. */
export function setLoadingWidth(indicator: HTMLElement, percent?: number) {
	if (percent === undefined) {
		measured.delete(indicator);
		indicator.style.removeProperty('inline-size');
		return;
	}
	const first = !measured.has(indicator);
	if (first) indicator.style.transition = 'none';
	indicator.style.inlineSize = `${percent}%`;
	if (first) {
		// One style/layout commit at the mode boundary. Without this, the browser
		// batches both writes and transitions from the old 34% sweep segment.
		indicator.getBoundingClientRect();
		indicator.style.removeProperty('transition');
		measured.add(indicator);
	}
}

export function loadingWidth(indicator: HTMLElement, percent?: number) {
	setLoadingWidth(indicator, percent);
	return { update: (percent?: number) => setLoadingWidth(indicator, percent) };
}
