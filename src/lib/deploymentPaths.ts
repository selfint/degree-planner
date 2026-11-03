import { base } from '$app/paths';

/** Add the build's deployment prefix to a root-relative app route or asset. */
export function withBase(path: string, prefix: string = base): string {
	return `${prefix}${path}`;
}

/** Normalize browser pathnames for route matching, without matching sibling sites. */
export function withoutBase(path: string, prefix: string = base): string {
	if (!prefix) return path;
	if (path === prefix) return '/';
	return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
}
