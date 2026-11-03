import { withBase, withoutBase } from './deploymentPaths';
const legacyRoute =
	/^\/(?:plan|settings|catalog|semester|search|course|preview|offline)(?:\/|$)/;
/** Preserve bookmarks, share links and same-origin storage. */
export function legacyConsoleDestination(url: URL): string | undefined {
	const pathname = withoutBase(url.pathname);
	return legacyRoute.test(pathname)
		? withBase(`/app${pathname}${url.search}${url.hash}`)
		: undefined;
}
