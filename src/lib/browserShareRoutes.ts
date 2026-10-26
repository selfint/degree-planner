const browserSharePath =
	/^\/share\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/;

/** Reuse the existing preview without redirecting its browser URL into PWA scope. */
export function browserShareDestination(pathname: string): string | undefined {
	return browserSharePath.test(pathname)
		? pathname.replace(/^\/share\//, '/app/preview/')
		: undefined;
}

/** Shared previews retain the same shell and account-readiness gates. */
export function consolePathname(pathname: string): string {
	return browserShareDestination(pathname) ?? pathname;
}

/** Enter service-worker scope with a new document, never an uncontrolled SPA page. */
export async function navigateFromBrowserShare(
	destination: string | URL,
	navigate: (destination: string | URL) => Promise<void>
): Promise<void> {
	if (typeof window !== 'undefined') {
		const next = new URL(destination, window.location.href);
		if (
			browserShareDestination(window.location.pathname) &&
			next.origin === window.location.origin &&
			/^\/app(?:\/|$)/.test(next.pathname)
		) {
			window.location.assign(next.href);
			return;
		}
	}
	await navigate(destination);
}
