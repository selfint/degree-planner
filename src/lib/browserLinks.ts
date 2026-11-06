/**
 * Let the platform handle an out-of-scope link from an installed web app.
 * A new window can remain app-owned on iOS; a normal navigation lets its
 * browser UI open instead. Ordinary browser tabs still open a new tab.
 * iOS chooses its browser sheet, not necessarily the separate Safari app.
 */
export function browserLink(node: HTMLAnchorElement) {
	const displayMode = window.matchMedia('(display-mode: standalone)');
	const update = () => {
		const standalone =
			displayMode.matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		node.target = standalone ? '_self' : '_blank';
	};
	update();
	displayMode.addEventListener('change', update);
	window.addEventListener('pageshow', update);
	return {
		destroy() {
			displayMode.removeEventListener('change', update);
			window.removeEventListener('pageshow', update);
		}
	};
}
