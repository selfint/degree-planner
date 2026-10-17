const legacyRoute =
	/^\/(?:plan|settings|catalog|semester|search|course|preview|offline)(?:\/|$)/;
/** Preserve bookmarks, share links and same-origin storage. */
export function legacyConsoleDestination(url: URL): string | undefined {
	return legacyRoute.test(url.pathname)
		? `/app${url.pathname}${url.search}${url.hash}`
		: undefined;
}
