import Sortable from 'sortablejs';

let cleanup: (() => void) | undefined;

export function endPlanDrag() {
	cleanup?.();
	cleanup = undefined;
}

/** Keep the preview out of document layout and scroll only real plan content. */
export function startPlanDrag(
	event: Sortable.SortableEvent & { originalEvent?: Event }
) {
	endPlanDrag();
	const ghost = Sortable.ghost;
	if (!ghost) return; // Native mouse dragging supplies its own preview.

	const overlay = document.createElement('div');
	overlay.dataset.planDragOverlay = '';
	overlay.style.cssText =
		'position:fixed;inset:0;overflow:clip;contain:strict;pointer-events:none;z-index:100000';
	const rect = ghost.getBoundingClientRect();
	const [grabX, grabY] = getComputedStyle(ghost)
		.transformOrigin.split(' ')
		.map(parseFloat);
	const contentHeight = document.documentElement.scrollHeight;
	ghost.style.position = 'absolute';
	ghost.style.left = `${rect.left}px`;
	ghost.style.top = `${rect.top}px`;
	document.body.append(overlay);
	overlay.append(ghost);

	let point = { x: rect.left + grabX, y: rect.top + grabY };
	let frame = 0;
	let previousTime = performance.now();
	function positionPreview() {
		// Sortable adds root-scroll offsets to its iOS transform. Compensate in
		// viewport coordinates so scrolling never moves the preview off the finger.
		const current = ghost!.getBoundingClientRect();
		ghost!.style.left = `${parseFloat(ghost!.style.left) + point.x - grabX - current.left}px`;
		ghost!.style.top = `${parseFloat(ghost!.style.top) + point.y - grabY - current.top}px`;
	}
	function track(event: Event) {
		const pointer =
			'touches' in event
				? (event as TouchEvent).touches[0]
				: (event as MouseEvent);
		if (!pointer) return;
		point = { x: pointer.clientX, y: pointer.clientY };
		positionPreview();
	}
	function edge(value: number, start: number, end: number) {
		return value >= end - 30 ? 1 : value <= start + 30 ? -1 : 0;
	}
	function scroll(time: number) {
		const distance = (Math.min(time - previousTime, 32) * 10) / 24;
		previousTime = time;
		const target = document.elementFromPoint(point.x, point.y);
		const region = target?.closest<HTMLElement>('[data-plan-scroll]');
		if (region) {
			const bounds = region.getBoundingClientRect();
			region.scrollLeft +=
				edge(
					point.x,
					Math.max(0, bounds.left),
					Math.min(innerWidth, bounds.right)
				) * distance;
		}
		// Long plans remain reachable, but a preview can never extend this bound.
		const maxY = Math.max(0, contentHeight - innerHeight);
		const nextY = Math.max(
			0,
			Math.min(maxY, scrollY + edge(point.y, 0, innerHeight) * distance)
		);
		if (nextY !== scrollY) window.scrollTo(scrollX, nextY);
		positionPreview();
		frame = requestAnimationFrame(scroll);
	}
	const events = ['pointermove', 'touchmove', 'mousemove'];
	for (const name of events) document.addEventListener(name, track);
	frame = requestAnimationFrame(scroll);
	cleanup = () => {
		cancelAnimationFrame(frame);
		for (const name of events) document.removeEventListener(name, track);
		overlay.remove();
	};
	if (event.originalEvent) track(event.originalEvent);
}
