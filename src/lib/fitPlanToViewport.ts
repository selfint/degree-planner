export function fitPlanToViewport(el: HTMLElement) {
	function update() {
		// Header wrapping and readiness notices change the space above the plan.
		// Fill the visible remainder, but let occupied semesters grow naturally.
		const top = el.getBoundingClientRect().top + window.scrollY;
		const bottomMargin = parseFloat(getComputedStyle(el).marginBottom);
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
		el.style.minHeight = `${Math.max(0, window.innerHeight - top - bottomMargin) / rem}rem`;
	}

	const main = el.closest('main');
	const resizeObserver = new ResizeObserver(update);
	function observeChrome() {
		resizeObserver.disconnect();
		let sibling = main?.previousElementSibling;
		while (sibling) {
			resizeObserver.observe(sibling);
			sibling = sibling.previousElementSibling;
		}
		update();
	}
	// Account/readiness notices can appear after mounting. Observe only changes
	// to the stable wrapper's direct children, not the plan subtree or styles:
	// updating min-height cannot trigger this observer or a resize of the chrome.
	const childrenObserver = new MutationObserver(observeChrome);
	if (main?.parentElement) {
		childrenObserver.observe(main.parentElement, { childList: true });
	}
	observeChrome();
	window.addEventListener('resize', update);
	return {
		destroy() {
			childrenObserver.disconnect();
			resizeObserver.disconnect();
			window.removeEventListener('resize', update);
		}
	};
}
